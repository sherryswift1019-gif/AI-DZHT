"""GitHub API 封装：PR 创建、状态查询、评论等。"""
from __future__ import annotations

import re
import time
from typing import Any

import httpx


def parse_repo_url(url: str) -> tuple[str, str]:
    """从仓库 URL 解析 owner 和 repo。支持 HTTPS / SSH / Enterprise。"""
    # https://github.com/org/repo.git | https://github.com/org/repo
    m = re.match(r"https?://[^/]+/([^/]+)/([^/.]+)", url)
    if m:
        return m.group(1), m.group(2)
    # git@github.com:org/repo.git
    m = re.match(r"git@[^:]+:([^/]+)/([^/.]+)", url)
    if m:
        return m.group(1), m.group(2)
    raise ValueError(f"无法解析仓库 URL: {url}")


class GitHubProvider:
    """Async GitHub API client with caching."""

    BASE = "https://api.github.com"
    _pr_status_cache: dict[int, tuple[float, dict]] = {}
    CACHE_TTL = 30

    def __init__(self, owner: str, repo: str, token: str):
        self.owner = owner
        self.repo = repo
        self.token = token
        self._client = httpx.AsyncClient(
            base_url=self.BASE,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            timeout=30,
        )

    async def test_connection(self) -> dict[str, Any]:
        """测试 Token 和仓库权限。"""
        r = await self._client.get(f"/repos/{self.owner}/{self.repo}")
        if r.status_code == 401:
            return {"ok": False, "error": "Token 无效或已过期"}
        if r.status_code == 403:
            return {"ok": False, "error": "Token 无此仓库权限"}
        if r.status_code == 404:
            return {"ok": False, "error": "仓库不存在或无权查看"}
        r.raise_for_status()
        d = r.json()
        return {
            "ok": True,
            "login": d["owner"]["login"],
            "default_branch": d["default_branch"],
            "permissions": d.get("permissions", {}),
        }

    async def get_pr_for_branch(self, branch: str) -> dict[str, Any] | None:
        """查找指定分支的 open PR。"""
        r = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/pulls",
            params={"head": f"{self.owner}:{branch}", "state": "open"},
        )
        r.raise_for_status()
        prs = r.json()
        return prs[0] if prs else None

    async def create_pr(self, head: str, base: str, title: str, body: str) -> dict[str, Any]:
        """创建 Pull Request。"""
        r = await self._client.post(
            f"/repos/{self.owner}/{self.repo}/pulls",
            json={"head": head, "base": base, "title": title, "body": body},
        )
        r.raise_for_status()
        d = r.json()
        return {"url": d["html_url"], "number": d["number"], "state": d["state"]}

    async def add_comment(self, pr_number: int, body: str) -> dict[str, Any]:
        """向 PR 添加评论。"""
        r = await self._client.post(
            f"/repos/{self.owner}/{self.repo}/issues/{pr_number}/comments",
            json={"body": body},
        )
        r.raise_for_status()
        return r.json()

    async def get_pr_status(self, pr_number: int) -> dict[str, Any]:
        """带 30s 缓存的 PR 状态查询。"""
        cached = self._pr_status_cache.get(pr_number)
        if cached and time.time() - cached[0] < self.CACHE_TTL:
            return cached[1]

        r = await self._client.get(f"/repos/{self.owner}/{self.repo}/pulls/{pr_number}")
        r.raise_for_status()
        d = r.json()

        reviews_r = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/pulls/{pr_number}/reviews"
        )
        reviews = reviews_r.json() if reviews_r.status_code == 200 else []

        result = {
            "state": "merged" if d.get("merged") else d["state"],
            "mergeable": d.get("mergeable"),
            "review_count": len(reviews),
            "approved": any(rv["state"] == "APPROVED" for rv in reviews),
            "changes_requested": any(rv["state"] == "CHANGES_REQUESTED" for rv in reviews),
            "additions": d.get("additions", 0),
            "deletions": d.get("deletions", 0),
            "changed_files": d.get("changed_files", 0),
            "checks_blocked": d.get("mergeable_state") == "blocked",
        }
        self._pr_status_cache[pr_number] = (time.time(), result)
        return result

    async def close(self) -> None:
        await self._client.aclose()
