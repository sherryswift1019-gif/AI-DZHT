"""Git 工作空间管理：每个需求在团队仓库创建独立分支，Agent 产出物写入文件。"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any

WORKSPACE_ROOT = Path(os.environ.get("WORKSPACE_ROOT", "./workspaces"))

# 产出物默认文件路径约定：(agent_role, artifact_type) → path template
_FILE_PATH_RULES: dict[tuple[str, str], str] = {
    ("reqLead", "document"): "docs/requirements/{req_code}/{name}.md",
    ("reqLead", "report"):   "docs/research/{req_code}/{name}.md",
    ("ux", "design"):        "docs/design/{req_code}/{name}.md",
    ("architect", "document"): "docs/architecture/{req_code}/{name}.md",
    ("dev", "code"):          "src/{name}",
    ("qa", "test"):           "tests/{name}",
}
_DEFAULT_PATH = "docs/{req_code}/{name}.md"


class WorkspaceManager:
    def __init__(self, project_id: str, repo_url: str, git_config: dict[str, Any] | None = None):
        self.project_id = project_id
        self.repo_url = repo_url
        self.repo_dir = WORKSPACE_ROOT / project_id / "repo"
        self.default_branch = (git_config or {}).get("defaultBranch", "main")
        self.branch_prefix = (git_config or {}).get("branchPrefix", "req/")

    def ensure_repo(self) -> bool:
        """Clone or fetch the repository. Returns True if repo is ready."""
        if not self.repo_url:
            return False
        if (self.repo_dir / ".git").exists():
            self._git("fetch", "origin")
            return True
        self.repo_dir.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", self.repo_url, str(self.repo_dir)],
            check=True, capture_output=True, text=True,
        )
        return True

    def create_branch(self, req_code: str) -> str:
        """Create or checkout a requirement branch from default branch."""
        branch = f"{self.branch_prefix}{req_code}"
        self._git("checkout", self.default_branch)
        self._git("pull", "origin", self.default_branch)
        try:
            self._git("checkout", branch)
        except subprocess.CalledProcessError:
            self._git("checkout", "-b", branch)
        return branch

    def write_artifact(self, req_code: str, agent_role: str, artifact: dict) -> str:
        """Write an artifact to file. Returns relative path."""
        path = self._resolve_path(req_code, agent_role, artifact)
        full_path = self.repo_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(artifact.get("content", ""), encoding="utf-8")
        self._git("add", path)
        return path

    def commit(self, message: str) -> str:
        """Commit staged changes. Returns commit hash or empty string."""
        try:
            self._git("commit", "-m", message)
            return self._git("rev-parse", "HEAD").strip()
        except subprocess.CalledProcessError:
            return ""  # nothing to commit

    def push(self, branch: str) -> None:
        """Push branch to remote."""
        self._git("push", "-u", "origin", branch)

    def get_tree(self, max_depth: int = 3) -> str:
        """Get file tree (excluding .git, node_modules, etc.)."""
        ignore = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}
        lines: list[str] = []

        def walk(p: Path, depth: int, prefix: str) -> None:
            if depth > max_depth:
                return
            try:
                entries = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name))
            except PermissionError:
                return
            for entry in entries:
                if entry.name in ignore:
                    continue
                lines.append(f"{prefix}{entry.name}{'/' if entry.is_dir() else ''}")
                if entry.is_dir():
                    walk(entry, depth + 1, prefix + "  ")

        walk(self.repo_dir, 0, "")
        return "\n".join(lines[:200])

    def read_file(self, path: str, max_lines: int = 200) -> str:
        """Read a file from the repo."""
        full = self.repo_dir / path
        if not full.exists() or not full.is_file():
            return ""
        text_lines = full.read_text(encoding="utf-8", errors="ignore").splitlines()
        return "\n".join(text_lines[:max_lines])

    def build_code_context(self, agent_role: str = "", max_chars: int = 12000) -> str:
        """Build code repository context for Agent prompts."""
        parts: list[str] = []

        # File tree
        tree = self.get_tree(max_depth=3)
        if tree:
            parts.append(f"[REPO STRUCTURE]\n{tree}")

        # Common key files
        for f in ["README.md", "package.json", "pyproject.toml"]:
            content = self.read_file(f, max_lines=60)
            if content:
                parts.append(f"[FILE: {f}]\n{content}")

        # Role-specific files
        if agent_role in ("dev", "qa", "architect"):
            for f in ["docker-compose.yml", ".env.example", "tsconfig.json",
                       "src/index.ts", "src/main.py"]:
                content = self.read_file(f, max_lines=100)
                if content:
                    parts.append(f"[FILE: {f}]\n{content}")

        # Existing requirement docs for analysis roles
        if agent_role in ("reqLead", "pm", "ux"):
            docs_dir = self.repo_dir / "docs"
            if docs_dir.exists():
                for md in sorted(docs_dir.rglob("*.md"))[:5]:
                    rel = md.relative_to(self.repo_dir)
                    content = self.read_file(str(rel), max_lines=50)
                    if content:
                        parts.append(f"[DOC: {rel}]\n{content}")

        result = "\n\n".join(parts)
        return result[:max_chars] if len(result) > max_chars else result

    def _resolve_path(self, req_code: str, agent_role: str, artifact: dict) -> str:
        if artifact.get("filePath"):
            return artifact["filePath"]
        key = (agent_role, artifact.get("type", "document"))
        template = _FILE_PATH_RULES.get(key, _DEFAULT_PATH)
        name = artifact.get("name", "untitled").replace(" ", "-").replace("/", "-")
        return template.format(req_code=req_code, name=name)

    def _git(self, *args: str) -> str:
        r = subprocess.run(
            ["git", *args], cwd=self.repo_dir,
            capture_output=True, text=True, check=True,
        )
        return r.stdout
