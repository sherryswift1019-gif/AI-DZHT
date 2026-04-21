"""Git 工作空间管理：每个需求通过 git worktree 获得独立工作目录，支持并发隔离。"""
from __future__ import annotations

import os
import subprocess
import threading
from pathlib import Path
from typing import Any

WORKSPACE_ROOT = Path(os.environ.get("WORKSPACE_ROOT", "./workspaces")).resolve()

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

# 项目级 fetch 锁，防止多需求同时 fetch 同一主仓库
_fetch_locks: dict[str, threading.Lock] = {}


class WorkspaceManager:
    def __init__(self, project_id: str, repo_url: str,
                 git_config: dict[str, Any] | None = None,
                 req_code: str | None = None):
        self.project_id = project_id
        self.repo_url = repo_url
        self.repo_dir = WORKSPACE_ROOT / project_id / "repo"
        self.req_code = req_code
        self.default_branch = (git_config or {}).get("defaultBranch", "main")
        self.branch_prefix = (git_config or {}).get("branchPrefix", "req/")
        # 有 req_code 时用 worktree，否则用主仓库（兼容只读操作）
        self.work_dir = (
            WORKSPACE_ROOT / project_id / "wt" / req_code
            if req_code else self.repo_dir
        )

    def ensure_repo(self) -> bool:
        """Clone or fetch the repository. Returns True if repo is ready."""
        if not self.repo_url:
            return False
        if (self.repo_dir / ".git").exists():
            lock = _fetch_locks.setdefault(self.project_id, threading.Lock())
            with lock:
                self._git("fetch", "origin", cwd=self.repo_dir)
                self._git("worktree", "prune", cwd=self.repo_dir)
            return True
        self.repo_dir.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", self.repo_url, str(self.repo_dir)],
            check=True, capture_output=True, text=True,
        )
        return True

    def create_branch(self, req_code: str) -> str:
        """Create worktree with requirement branch. Handles branch reuse and stale worktrees."""
        self.req_code = req_code
        self.work_dir = WORKSPACE_ROOT / self.project_id / "wt" / req_code
        branch = f"{self.branch_prefix}{req_code}"

        # 清理残留 worktree
        if self.work_dir.exists():
            self._git("worktree", "remove", "--force", str(self.work_dir),
                       cwd=self.repo_dir)

        # 更新远程信息
        self._git("fetch", "origin", cwd=self.repo_dir)

        # 尝试复用已有分支；不存在则新建
        try:
            self._git("worktree", "add", str(self.work_dir), branch,
                       cwd=self.repo_dir)
            # 拉取远程最新（分支可能在 GitHub 上被修改过）
            try:
                self._git("pull", "--rebase", "origin", branch)
            except subprocess.CalledProcessError:
                pass  # 远程分支可能不存在（首次创建），忽略
        except subprocess.CalledProcessError:
            # 分支不存在 → 基于默认分支新建
            self._git("worktree", "add", str(self.work_dir), "-b", branch,
                       f"origin/{self.default_branch}", cwd=self.repo_dir)
        return branch

    def write_artifact(self, req_code: str, agent_role: str, artifact: dict) -> str:
        """Write an artifact to file. Returns relative path."""
        path = self._resolve_path(req_code, agent_role, artifact)
        full_path = self.work_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(artifact.get("content", ""), encoding="utf-8")
        self._git("add", path)
        return path

    def commit(self, message: str, author_name: str = "AI-DZHT") -> str:
        """Commit staged changes. Returns commit hash or empty string."""
        try:
            self._git("commit", "-m", message,
                       "--author", f"{author_name} <agent@ai-dzht.local>")
            return self._git("rev-parse", "HEAD").strip()
        except subprocess.CalledProcessError:
            return ""  # nothing to commit

    def push(self, branch: str) -> None:
        """Push branch to remote with non-fast-forward protection."""
        try:
            self._git("push", "-u", "origin", branch)
        except subprocess.CalledProcessError as e:
            if "non-fast-forward" in (e.stderr or ""):
                self._git("pull", "--rebase", "origin", branch)
                self._git("push", "-u", "origin", branch)
            else:
                raise

    def cleanup(self) -> None:
        """清理 worktree。仅在确认不再需要时调用。"""
        if (self.work_dir and self.work_dir != self.repo_dir
                and self.work_dir.exists()):
            try:
                self._git("worktree", "remove", str(self.work_dir),
                           cwd=self.repo_dir)
            except subprocess.CalledProcessError:
                pass  # 有未提交更改时 remove 会失败，不强制删除

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

        walk(self.work_dir, 0, "")
        return "\n".join(lines[:200])

    def read_file(self, path: str, max_lines: int = 200) -> str:
        """Read a file from the repo."""
        full = self.work_dir / path
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
            docs_dir = self.work_dir / "docs"
            if docs_dir.exists():
                for md in sorted(docs_dir.rglob("*.md"))[:5]:
                    rel = md.relative_to(self.work_dir)
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

    def _git(self, *args: str, cwd: Path | None = None) -> str:
        r = subprocess.run(
            ["git", *args], cwd=cwd or self.work_dir,
            capture_output=True, text=True, check=True,
        )
        return r.stdout
