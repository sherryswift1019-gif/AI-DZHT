# 技术架构设计：用户管理模块

## 1. 现状分析

### 1.1 已有能力

| 层级 | 现状 | 文件 |
|------|------|------|
| 数据库 | `users` 表已存在，含 id / username / display_name / email / role / status / avatar / created_at / updated_at | `app/database.py:221-233` |
| 存储层 | `get_all_users`, `get_user`, `get_user_by_username`, `save_user`, `delete_user` 已实现 | `app/storage.py` |
| API 路由 | CRUD 7 个端点已实现（列表/详情/创建/更新/删除/禁用/启用） | `app/routers/users.py` |
| Pydantic | `UserOut`, `UserCreateRequest`, `UserPatchRequest`, `UserListResponse` 已定义 | `app/models.py:556-591` |
| 测试 | `tests/test_users_api.py` 覆盖 CRUD + 禁用/启用，使用临时 SQLite | `tests/test_users_api.py` |

### 1.2 缺失能力

| 能力 | 状态 |
|------|------|
| 密码存储与验证 | 无 — `users` 表无 `password_hash` 字段 |
| 登录端点 | 无 — 所有端点开放，无认证中间件 |
| 会话/Token 管理 | 无 — 无 JWT/session 机制 |
| 邀请注册 | 无 — 无 `invitations` 表，无邀请码生成与验证 |
| 前端认证 | 无 — 无登录页、auth context、路由守卫 |

---

## 2. 架构决策记录 (ADR)

### ADR-01: 密码哈希方案 → bcrypt (passlib)

**选型理由：**
- bcrypt 自带盐值、可调 cost factor，是密码存储的行业标准
- `passlib[bcrypt]` 是 FastAPI 生态推荐库，与 `python-jose` 配合成熟
- SQLite 单文件部署无需外部缓存（排除 session 方案对 Redis 的依赖）

**替代方案排除：**
- argon2：性能优异但 Python 安装复杂（需 C 编译），团队规模不需要
- SHA256 + salt：安全强度不足，不符合 OWASP 最佳实践

### ADR-02: 认证机制 → JWT (HS256) + HTTPBearer

**选型理由：**
- 无状态，与 FastAPI `Depends` 天然集成，无需 session 中间件
- HS256 对称加密足够内部平台使用，密钥管理简单
- 前端 SPA 适合 `Authorization: Bearer <token>` 模式

**Token 策略：**
| 参数 | 值 | 说明 |
|------|-----|------|
| 算法 | HS256 | 对称签名，密钥由环境变量 `JWT_SECRET` 提供 |
| access_token 有效期 | 24h | 内部平台，低频登录体验优先 |
| Payload | `{"sub": user_id, "role": role, "exp": ...}` | 最小化 claims |

**暂不实现 refresh_token** — 当前为内部团队平台，24h access_token 已满足使用场景。后续用户量增长时可追加。

### ADR-03: 邀请注册 → 邀请码 + 独立注册端点

**机制：**
1. Admin 用户调用 `POST /api/v1/invitations` 生成邀请码（含预设角色、过期时间）
2. 被邀请人使用邀请码调用 `POST /api/v1/auth/register` 完成注册
3. 邀请码一次性使用，使用后标记 `used_at` + `used_by`

**选型理由：**
- 比邮件链接简单（不依赖 SMTP 服务），适合内部团队
- 邀请码 8 字符 (`secrets.token_urlsafe(6)`)，人类可读可传递
- 审计可追溯（谁邀请了谁、何时使用）

---

## 3. 数据库扩展设计

### 3.1 users 表变更

```sql
-- 新增列（增量迁移，兼容存量数据）
ALTER TABLE users ADD COLUMN password_hash TEXT;  -- bcrypt hash, 现有用户为 NULL
```

**迁移策略：** 在 `database._migrate_add_columns()` 中追加列检测，存量用户 `password_hash = NULL` 表示尚未设置密码，需通过管理员重置或邀请注册流程设置。

### 3.2 invitations 表（新建）

```python
invitations_table = Table(
    "invitations",
    metadata,
    Column("id", String, primary_key=True),          # uuid4
    Column("code", String, nullable=False, unique=True),  # 8字符邀请码
    Column("role", String, default="member"),         # 预设角色
    Column("created_by", String, nullable=False),     # 邀请人 user_id
    Column("expires_at", Integer, nullable=False),    # Unix timestamp
    Column("used_at", Integer, nullable=True),        # 使用时间
    Column("used_by", String, nullable=True),         # 注册用户 user_id
    Column("created_at", Integer, nullable=False),
)
```

### 3.3 行转换函数

```python
def row_to_invitation(row) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "role": row.role,
        "createdBy": row.created_by,
        "expiresAt": row.expires_at,
        "usedAt": row.used_at,
        "usedBy": row.used_by,
        "createdAt": row.created_at,
    }
```

---

## 4. API 设计

### 4.1 认证端点（新路由模块 `routers/auth.py`）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/v1/auth/login` | 账号密码登录，返回 JWT | 无 |
| `POST` | `/api/v1/auth/register` | 邀请码注册 | 无 |
| `GET` | `/api/v1/auth/me` | 获取当前登录用户信息 | Bearer |
| `POST` | `/api/v1/auth/change-password` | 修改密码 | Bearer |

#### 4.1.1 登录 — `POST /api/v1/auth/login`

```
Request:
{
  "username": "zhangshanshan",
  "password": "MyP@ssw0rd"
}

Response 200:
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "bearer",
  "user": { ...UserOut }
}

Response 401:
{ "detail": "Invalid username or password" }

Response 403:
{ "detail": "Account is disabled" }
```

**安全要求：**
- 用户名不存在与密码错误返回**相同错误信息**（防用户名枚举）
- 禁用用户 (`status=disabled`) 返回 403

#### 4.1.2 邀请注册 — `POST /api/v1/auth/register`

```
Request:
{
  "inviteCode": "Ab3xK9mQ",
  "username": "newuser",
  "displayName": "新成员",
  "email": "new@example.com",
  "password": "SecureP@ss1"
}

Response 201:
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "bearer",
  "user": { ...UserOut }
}

Response 400: { "detail": "Invalid or expired invite code" }
Response 409: { "detail": "Username already exists" }
```

### 4.2 邀请管理端点（扩展 `routers/users.py`）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/v1/invitations` | 生成邀请码 | Bearer (admin) |
| `GET` | `/api/v1/invitations` | 列出邀请记录 | Bearer (admin) |
| `DELETE` | `/api/v1/invitations/{id}` | 撤销未使用的邀请 | Bearer (admin) |

#### 4.2.1 生成邀请码 — `POST /api/v1/invitations`

```
Request:
{
  "role": "member",          // 可选，默认 member
  "expiresInHours": 72       // 可选，默认 72 小时
}

Response 201:
{
  "id": "inv-xxx",
  "code": "Ab3xK9mQ",
  "role": "member",
  "expiresAt": 1750000000,
  "createdBy": "u1"
}
```

### 4.3 现有端点认证改造

**策略：渐进式保护**

```python
# app/auth.py — 认证依赖

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """解析 JWT，返回用户信息。无 token 或无效 token 抛 401。"""
    if not cred:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(cred.credentials)  # 验证签名 + 过期
    user = get_user(payload["sub"])
    if not user or user["status"] == "disabled":
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """限定 admin 角色。"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user
```

**保护范围：**

| 模块 | 保护级别 | 说明 |
|------|---------|------|
| `/api/v1/auth/*` | 公开 | 登录、注册无需认证 |
| `/api/v1/users` (CRUD) | `require_admin` | 仅管理员可管理用户 |
| `/api/v1/invitations` | `require_admin` | 仅管理员可邀请 |
| `/api/v1/projects/*` | `get_current_user` | 登录用户可访问 |
| `/api/v1/agents/*` | `get_current_user` | 登录用户可访问 |
| `/health` | 公开 | 健康检查 |

### 4.4 密码校验规则

```python
MIN_PASSWORD_LENGTH = 8

def validate_password(password: str) -> None:
    """密码强度校验：≥8 字符，至少含字母和数字。"""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        raise HTTPException(400, "Password must contain letters and digits")
```

---

## 5. Pydantic 模型扩展

```python
# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    inviteCode: str
    username: str
    displayName: str
    email: str
    password: str

class AuthResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    user: UserOut

class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str

# ── Invitations ─────────────────────────────────────────────────────────────

class InvitationOut(BaseModel):
    id: str
    code: str
    role: UserRole
    createdBy: str
    expiresAt: int
    usedAt: Optional[int] = None
    usedBy: Optional[str] = None
    createdAt: int

class InvitationCreateRequest(BaseModel):
    role: UserRole = "member"
    expiresInHours: int = 72

class InvitationListResponse(BaseModel):
    data: list[InvitationOut]
    total: int
```

---

## 6. 存储层扩展

在 `app/storage.py` 中追加：

```python
# ── Invitations ─────────────────────────────────────────────────────────────

def save_invitation(inv_id: str, data: dict) -> None: ...
def get_invitation_by_code(code: str) -> dict | None: ...
def get_all_invitations() -> list[dict]: ...
def mark_invitation_used(inv_id: str, user_id: str) -> None: ...
def delete_invitation(inv_id: str) -> None: ...

# ── Users (扩展) ──────────────────────────────────────────────────────────

def get_user_with_password(user_id: str) -> dict | None:
    """返回含 password_hash 的用户记录（仅认证流程使用）。"""

def get_user_by_username_with_password(username: str) -> dict | None:
    """按 username 查询含 password_hash 的记录。"""
```

---

## 7. 文件组织

```
backend/
├── app/
│   ├── auth.py                 # 新增：JWT 工具 + 依赖注入（get_current_user, require_admin）
│   ├── routers/
│   │   ├── auth.py             # 新增：/api/v1/auth/* 端点
│   │   ├── invitations.py      # 新增：/api/v1/invitations 端点
│   │   ├── users.py            # 修改：添加 Depends(require_admin) 保护
│   │   ├── projects.py         # 修改：添加 Depends(get_current_user)
│   │   ├── agents.py           # 修改：添加 Depends(get_current_user)
│   │   ├── requirements.py     # 修改：添加 Depends(get_current_user)
│   │   └── ...
│   ├── database.py             # 修改：新增 invitations_table + password_hash 列迁移
│   ├── models.py               # 修改：新增 Auth/Invitation 模型
│   ├── storage.py              # 修改：新增 invitation CRUD + 密码查询函数
│   └── main.py                 # 修改：挂载 auth_router, invitation_router
├── tests/
│   ├── conftest.py             # 新增：共享 fixture 提取
│   ├── test_users_api.py       # 修改：适配认证（携带 token）
│   ├── test_auth_api.py        # 新增：登录/注册/改密码测试
│   ├── test_invitations_api.py # 新增：邀请码全流程测试
│   └── test_e2e_user_flow.py   # 新增：端到端场景测试
```

---

## 8. 依赖管理

### 8.1 新增 Python 包

```
passlib[bcrypt]>=1.7.4      # 密码哈希
python-jose[cryptography]   # JWT 编解码
```

### 8.2 环境变量

```env
JWT_SECRET=<随机 32+ 字符密钥>    # 必须配置，启动时校验
JWT_EXPIRE_HOURS=24               # 可选，默认 24
```

---

## 9. 存量数据迁移方案

### 9.1 密码列迁移

```python
# database._migrate_add_columns() 追加
try:
    conn.execute(sqlalchemy.text("SELECT password_hash FROM users LIMIT 1"))
except Exception:
    conn.execute(sqlalchemy.text("ALTER TABLE users ADD COLUMN password_hash TEXT"))
    conn.commit()
```

### 9.2 种子用户密码初始化

```python
# database._seed_users_if_empty() 中
# 为种子用户生成默认密码 hash（密码 = "admin123" 或 "changeme"）
# 开发环境方便调试，生产环境首次登录强制改密码
```

### 9.3 前端兼容

开发阶段可通过 **环境变量 `AUTH_DISABLED=true`** 跳过认证检查，让前端在未实现登录页前仍能正常调试。生产环境移除此旁路。

```python
def get_current_user(...) -> dict:
    if os.environ.get("AUTH_DISABLED") == "true":
        return get_user("u1")  # 开发模式返回默认管理员
    ...
```

---

## 10. E2E 测试架构

### 10.1 测试分层

```
┌─────────────────────────────────────────┐
│         E2E 场景测试 (test_e2e_*)       │  ← 业务流程验证
├─────────────────────────────────────────┤
│       API 集成测试 (test_*_api.py)      │  ← 端点行为验证
├─────────────────────────────────────────┤
│       存储层单元测试 (test_storage.py)   │  ← 数据持久化验证
└─────────────────────────────────────────┘
         全部使用临时 SQLite（真实数据库）
```

### 10.2 共享 Fixture (`tests/conftest.py`)

从现有 `test_users_api.py` 提取并增强：

```python
@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """每个测试用例使用独立临时 SQLite，保证隔离性。"""
    db_path = str(tmp_path / "test.db")
    monkeypatch.setenv("DB_PATH", db_path)
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-for-testing-only")
    monkeypatch.setenv("AUTH_DISABLED", "false")
    # ... engine 替换逻辑（同现有模式）
    database.metadata.create_all(new_engine)
    database._seed_if_empty()
    database._seed_users_if_empty()
    yield

@pytest.fixture
def client():
    """未认证的 TestClient。"""
    from app.main import app
    return TestClient(app)

@pytest.fixture
def admin_client(client):
    """已认证的管理员 TestClient（自动登录 + 携带 token）。"""
    # 先为种子用户设置密码，再登录获取 token
    r = client.post("/api/v1/auth/login", json={
        "username": "zhangshanshan", "password": "admin123"
    })
    token = r.json()["accessToken"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client

@pytest.fixture
def member_client(client):
    """已认证的普通成员 TestClient。"""
    ...
```

### 10.3 测试用例矩阵

#### test_auth_api.py — 认证端点

| 用例 | 验证点 |
|------|--------|
| 正确凭据登录成功 | 返回 200 + accessToken + user 信息 |
| 错误密码返回 401 | 不泄露"用户不存在"信息 |
| 不存在用户返回 401 | 同上，防枚举 |
| 禁用用户登录返回 403 | status=disabled 无法登录 |
| 获取当前用户 `/me` | Bearer token 解析正确 |
| 无 token 访问 `/me` 返回 401 | 认证拦截生效 |
| 过期 token 返回 401 | JWT 过期校验 |
| 修改密码成功 | 旧密码验证 + 新密码生效 |
| 旧密码错误拒绝修改 | 返回 400 |

#### test_invitations_api.py — 邀请注册

| 用例 | 验证点 |
|------|--------|
| 管理员创建邀请码 | 返回有效 code + 预设 role |
| 非管理员创建邀请返回 403 | 权限守卫生效 |
| 使用邀请码注册成功 | 自动创建用户 + 返回 token + 邀请码标记已用 |
| 重复使用邀请码返回 400 | 一码一用 |
| 过期邀请码返回 400 | 时间校验 |
| 注册时用户名重复返回 409 | 唯一性约束 |
| 密码不符合强度要求返回 400 | 校验规则生效 |
| 列出邀请记录 | 含已用/未用状态 |
| 撤销未使用邀请 | 删除成功 |

#### test_e2e_user_flow.py — 端到端场景

| 场景 | 步骤 |
|------|------|
| **完整注册-登录流** | admin 登录 → 创建邀请码 → 新用户注册 → 新用户登录 → 访问 /me |
| **用户生命周期** | admin 创建用户 → 用户登录 → admin 禁用 → 用户登录失败 → admin 启用 → 用户登录成功 |
| **权限隔离** | member 登录 → 尝试创建邀请返回 403 → 尝试删除用户返回 403 → 正常访问 projects |
| **密码管理** | 用户登录 → 修改密码 → 用旧密码登录失败 → 用新密码登录成功 |
| **邀请码安全** | 创建邀请 → 使用注册 → 再次使用同一邀请码失败 → 创建新邀请 → 设置短过期 → 等过期后注册失败 |

### 10.4 现有测试适配

`test_users_api.py` 需调整：
- 所有 CRUD 端点改用 `admin_client` fixture（携带 admin token）
- 测试结构不变，仅注入认证头

---

## 11. 安全检查清单

| 项目 | 措施 |
|------|------|
| 密码存储 | bcrypt 哈希，永不明文存储 |
| 密码传输 | HTTPS（生产）+ 请求体传输（非 URL 参数） |
| JWT 密钥 | 环境变量注入，不硬编码 |
| 用户枚举 | 登录失败统一返回 "Invalid username or password" |
| 邀请码安全 | `secrets.token_urlsafe(6)` 生成，一次性使用 |
| 禁用账户 | 登录、token 验证双重检查 |
| 密码强度 | ≥8 字符 + 字母 + 数字 |
| SQL 注入 | SQLAlchemy 参数化查询（已有模式保障） |
| CORS | 已配置白名单（`localhost:5173/5174/4173`） |

---

## 12. 实施优先级

```
Phase 1 — 基础认证（MVP）
  ├── 数据库: password_hash 列 + invitations 表
  ├── 后端: auth.py 模块 + login 端点
  ├── 测试: test_auth_api.py
  └── 开发旁路: AUTH_DISABLED 环境变量

Phase 2 — 邀请注册
  ├── 后端: register 端点 + invitations CRUD
  ├── 测试: test_invitations_api.py
  └── 种子数据: 管理员默认密码

Phase 3 — 端点保护
  ├── 后端: 现有路由添加 Depends
  ├── 测试: test_users_api.py 适配
  └── /me + change-password 端点

Phase 4 — E2E 场景
  ├── conftest.py 提取
  ├── test_e2e_user_flow.py
  └── 全场景覆盖验收
```

---

## 13. 架构约束与边界

1. **不引入 Redis / Session Store** — SQLite + JWT 无状态方案满足当前规模
2. **不实现 OAuth/OIDC** — 内部平台，账号密码登录足够
3. **不实现邮件通知** — 邀请码通过人工传递（IM/口头），不依赖 SMTP
4. **不实现多因素认证** — 非高安全等级场景，MVP 阶段不必要
5. **不修改前端** — 本架构仅覆盖后端，前端登录页由 UX + Dev Agent 后续承接
6. **refresh_token 延后** — 单 token 模式，后续按需追加