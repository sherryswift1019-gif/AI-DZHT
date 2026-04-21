# 头脑风暴：E2E测试-用户管理模块

## 1. 现状评估（事实基础）

| 层级 | 状态 | 详情 |
|------|------|------|
| 后端 CRUD API | ✅ 已完成 | 7 个端点：list / get / create / update / delete / disable / enable |
| 数据库 Schema | ✅ 已完成 | `users_table`：id, username, display_name, email, role, status, avatar, timestamps |
| 后端 pytest | ✅ 已完成 | `tests/test_users_api.py`，211 行，覆盖 6 组场景 |
| **密码字段** | ❌ 缺失 | 数据库和模型中均无 `password_hash` 字段 |
| **认证中间件** | ❌ 缺失 | 所有端点无鉴权，无 JWT/Session 机制 |
| **邀请机制** | ❌ 缺失 | 无邀请码/邀请链接相关逻辑 |
| 前端用户页面 | ❌ 缺失 | 无类型定义、无 hooks、无 UI 页面 |
| 前端登录页面 | ❌ 缺失 | 无 AuthContext、无登录/注册页面 |
| 前端集成 | ⚠️ 硬编码 | `TEAM_MEMBERS` 写死在 `types/project.ts`，未接 API |

**关键发现**：后端 CRUD 骨架存在但认证能力为零，需求描述中的「账号密码登录」和「邀请注册」是全新功能域。

---

## 2. 功能域拆解

### 2.1 用户 CRUD（增强现有）

| 子功能 | 描述 | 后端改动 | 前端改动 |
|--------|------|----------|----------|
| 用户列表 | 分页、搜索、按角色/状态筛选 | 现有 `GET /users` 需加 query 参数 | 新建 `UserListPage` |
| 用户详情 | 查看用户完整信息 | 现有 `GET /users/{id}` 可复用 | 新建 `UserDetailPage` 或 Drawer |
| 创建用户 | 管理员手动创建用户 | 现有 `POST /users` 需增加密码字段 | 新建 `CreateUserModal` |
| 编辑用户 | 修改显示名、邮箱、角色、头像 | 现有 `PATCH /users/{id}` 可复用 | 新建 `EditUserModal` |
| 删除用户 | 逻辑删除或物理删除 | 现有 `DELETE /users/{id}`，需决策软/硬删 | 二次确认弹窗 |
| 禁用/启用 | 切换用户状态 | 现有 `POST /users/{id}/disable|enable` | 状态切换开关 |

### 2.2 账号密码登录（全新）

| 子功能 | 描述 | 技术要点 |
|--------|------|----------|
| 密码存储 | 新增 `password_hash` 字段 | bcrypt/argon2 哈希，**禁止明文存储** |
| 登录端点 | `POST /api/v1/auth/login` | 验证用户名+密码，返回 token |
| Token 机制 | JWT access token + refresh token | 或 httpOnly cookie session |
| 登出端点 | `POST /api/v1/auth/logout` | 清除 token / session |
| 当前用户 | `GET /api/v1/auth/me` | 返回当前登录用户信息 |
| 前端鉴权 | AuthContext + ProtectedRoute | 未登录重定向到登录页 |
| 登录页面 | 用户名+密码表单 | 错误提示、登录状态管理 |

### 2.3 邀请注册（全新）

| 子功能 | 描述 | 技术要点 |
|--------|------|----------|
| 生成邀请 | 管理员创建邀请码/链接 | `POST /api/v1/invitations`，含过期时间和预设角色 |
| 邀请记录 | 新增 `invitations` 表 | code, email, role, status, expires_at, inviter_id |
| 注册页面 | 受邀用户设置密码完成注册 | `POST /api/v1/auth/register?code=xxx` |
| 邀请管理 | 管理员查看/撤销邀请 | 列表页 + 状态管理 |
| 邮件通知 | 发送邀请邮件（可选） | MVP 可先做链接复制，后期加邮件 |

---

## 3. 技术方案讨论

### 3.1 认证方案选型

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **JWT (推荐)** | 无状态、前后端分离友好、已有 Token 加密基础 | 无法即时注销、需 refresh 机制 | ✅ 本项目：SPA + REST API |
| Session Cookie | 服务端控制、即时注销 | 需 session store、CORS 复杂 | 传统多页应用 |
| OAuth2 / OIDC | 企业级、可对接外部 IDP | 过重、MVP 不需要 | 企业级部署阶段 |

**建议**：JWT + httpOnly cookie 存储 refresh token，localStorage 存 access token。理由：
1. 项目已有 Fernet 加密基础设施（`storage.py` 中用于 GitHub token）
2. SPA 架构天然适配 JWT
3. SQLite 单文件部署，不适合引入 Redis 做 session store

### 3.2 密码安全方案

| 项目 | 方案 |
|------|------|
| 哈希算法 | `bcrypt`（Python: `passlib[bcrypt]` 或 `bcrypt` 库） |
| 盐值 | bcrypt 自动生成，无需额外管理 |
| 密码策略 | 最少 8 字符，含字母和数字（MVP） |
| 传输安全 | HTTPS（部署环境）+ 开发环境豁免 |

### 3.3 数据库变更

```
-- users 表新增字段
ALTER TABLE users ADD COLUMN password_hash TEXT;  -- 可为空（邀请未完成时）

-- 新增 invitations 表
CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'pending',  -- pending | accepted | expired | revoked
    inviter_id TEXT REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT 0
);
```

### 3.4 前端架构扩展

```
frontend/src/
├── types/user.ts              # User, UserRole, Invitation 类型
├── hooks/useUsers.ts          # 用户 CRUD hooks (TanStack Query)
├── hooks/useAuth.ts           # 登录/登出/当前用户 hooks
├── hooks/useInvitations.ts    # 邀请管理 hooks
├── contexts/AuthContext.tsx    # 认证上下文 + ProtectedRoute
├── pages/auth/
│   ├── LoginPage.tsx          # 登录页
│   └── RegisterPage.tsx       # 邀请注册页
├── pages/user-management/
│   ├── UserListPage.tsx       # 用户列表
│   └── UserDetailPage.tsx     # 用户详情（可选）
└── components/users/
    ├── UserTable.tsx           # 用户表格
    ├── CreateUserModal.tsx     # 创建用户弹窗
    ├── EditUserModal.tsx       # 编辑用户弹窗
    └── InviteUserModal.tsx     # 邀请用户弹窗
```

---

## 4. E2E 测试策略思考

### 4.1 测试分层

| 层级 | 工具 | 覆盖范围 | 现状 |
|------|------|----------|------|
| 后端 API 测试 | pytest + TestClient | 所有 API 端点 | ✅ CRUD 已覆盖，需扩展 auth |
| 前端组件测试 | vitest + testing-library | 表单校验、状态渲染 | ❌ 待新建 |
| **E2E 集成测试** | **Playwright (推荐)** | 完整用户流程 | ❌ 待新建 |

### 4.2 E2E 核心场景清单

| 编号 | 场景 | 优先级 | 前置条件 |
|------|------|--------|----------|
| E2E-01 | 管理员登录 → 进入系统 | P0 | 登录功能就绪 |
| E2E-02 | 未登录 → 访问受保护页面 → 重定向到登录页 | P0 | 路由守卫就绪 |
| E2E-03 | 管理员创建用户 → 用户出现在列表中 | P0 | 用户管理页就绪 |
| E2E-04 | 管理员编辑用户信息 → 信息更新成功 | P1 | |
| E2E-05 | 管理员禁用用户 → 该用户无法登录 | P1 | |
| E2E-06 | 管理员删除用户 → 用户从列表消失 | P1 | |
| E2E-07 | 管理员发送邀请 → 受邀用户通过链接注册 | P0 | 邀请功能就绪 |
| E2E-08 | 使用已过期邀请码注册 → 提示已过期 | P1 | |
| E2E-09 | 错误密码登录 → 显示错误提示 | P0 | |
| E2E-10 | 非管理员尝试管理用户 → 无权限提示 | P2 | RBAC 就绪 |

### 4.3 测试基础设施需求

- **Playwright** 安装与配置（`playwright.config.ts`）
- 测试数据隔离：每个 E2E 用例使用独立 SQLite 文件或事务回滚
- API fixture：通过 `POST /api/v1/auth/login` 获取 token，注入到页面 context
- CI 集成：GitHub Actions 运行 Playwright（headless Chromium）

---

## 5. 风险与约束

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `data.db` 不可删除（项目硬约束） | 测试不能破坏生产数据 | E2E 测试使用独立的 `test.db`，通过环境变量切换 |
| SQLite 无并发写入能力 | 并行 E2E 测试可能冲突 | 串行执行 E2E 或每个 worker 独立 db 文件 |
| 无现有前端测试基础 | 测试框架搭建有额外工作量 | 先搭 Playwright 骨架，逐步补充用例 |
| 登录功能是 E2E 的前置依赖 | E2E 用例无法先于登录功能开发 | 优先实现登录闭环，再展开其他用例 |
| 密码安全合规 | 弱密码可能引入安全风险 | bcrypt 哈希 + 密码强度校验 |

---

## 6. 优先级矩阵与实施建议

### Phase 1：登录闭环（P0，阻塞其他所有 E2E）
1. 后端：`users` 表加 `password_hash` 字段 + 迁移
2. 后端：`POST /auth/login`、`POST /auth/logout`、`GET /auth/me`
3. 前端：`LoginPage` + `AuthContext` + `ProtectedRoute`
4. E2E：登录成功 / 失败 / 未登录重定向

### Phase 2：用户 CRUD UI + E2E
1. 前端：`types/user.ts` + `useUsers.ts` + 用户管理页面全套
2. 前端：替换 `TEAM_MEMBERS` 硬编码为 API 数据
3. E2E：创建 / 编辑 / 删除 / 禁用用户全流程

### Phase 3：邀请注册 + E2E
1. 后端：`invitations` 表 + 邀请 API + 注册端点
2. 前端：`InviteUserModal` + `RegisterPage`
3. E2E：发送邀请 → 注册 → 登录完整链路

### Phase 4：权限控制 + 边界 E2E
1. 后端：API 端点加角色校验中间件
2. 前端：按角色渲染 UI 元素
3. E2E：非管理员操作受限场景

---

## 7. 开放问题（需决策）

| # | 问题 | 候选方案 | 建议 |
|---|------|----------|------|
| Q1 | 删除用户是软删除还是硬删除？ | A: 硬删（当前实现）B: 软删（加 `deleted_at`） | **软删除**——已有 `disable` 可临时封禁，软删可审计 |
| Q2 | 邀请码形式？ | A: 随机短码（如 `ABC123`）B: UUID 长链接 | **UUID 链接**——安全性更高，用户体验无差别 |
| Q3 | MVP 是否需要邮件发送？ | A: 需要 B: 仅复制链接 | **仅复制链接**——避免引入邮件服务依赖 |
| Q4 | Token 有效期？ | A: 15min access + 7d refresh B: 24h 单 token | **方案 A**——更安全，refresh 机制已是行业标准 |
| Q5 | 是否需要「修改密码」功能？ | A: MVP 包含 B: 后续迭代 | **MVP 包含**——基础安全需求，实现成本低 |

---

## 8. 与项目架构的对齐检查

| 架构规则 | 对齐方案 |
|----------|----------|
| 所有状态可追踪 | 邀请状态机：`pending → accepted / expired / revoked` |
| `import type` 分离 | 前端类型文件严格使用 `import type` |
| API 路由 `/api/v1/` 前缀 | auth 路由：`/api/v1/auth/*`，邀请路由：`/api/v1/invitations/*` |
| Pydantic BaseModel | 所有请求/响应模型继承 `BaseModel` |
| SQLAlchemy Core（禁 ORM） | 新表和查询继续使用 Core 风格 |
| 核心 API 有自动化测试 | auth/invitation 端点全部配套 pytest 测试 |
| 测试用真实 SQLite | E2E 和 API 测试均使用真实 SQLite 实例 |