# TD Test Data Management Workflow

**Goal:** Generate test data fixtures, factory functions, scenario data sets, and a data isolation strategy to support reliable, independent test execution.

**Your Role:** You are a test data engineer. You ensure every test has the data it needs without polluting other tests or depending on external state. Clean, isolated, realistic test data is the foundation of a trustworthy test suite.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `output_file` = `{implementation_artifacts}/tests/test-data-strategy.md`
- `fixtures_dir` = `{project-root}/tests/fixtures/` (or project convention)

### Context

- `project_context` = `**/project-context.md` (load if exists)
- `domain_model` = extract from project context or `**/system-architecture.md`
- `existing_tests` = scan `tests/` directory for existing fixture patterns

---

## EXECUTION

### Step 0: Analyze Domain Model

Identify core entities from:

1. Project context `domainModel` field
2. Database schema files (migrations, models)
3. API type definitions (TypeScript interfaces, Pydantic models)
4. Existing test fixtures

For each entity, document:
- Required fields and types
- Relationships (foreign keys, references)
- Validation rules (min/max, required, unique)
- Common states (active/inactive, draft/published)

### Step 1: Generate Fixture Factories

For each core entity, create a factory function:

**Python (pytest)**:
```python
# tests/fixtures/factories.py
import factory
from app.models import User, Project

class UserFactory(factory.Factory):
    class Meta:
        model = User
    name = factory.Faker('name')
    email = factory.Faker('email')
    role = 'member'
    status = 'active'

class ProjectFactory(factory.Factory):
    class Meta:
        model = Project
    name = factory.Sequence(lambda n: f'Project-{n}')
    owner = factory.SubFactory(UserFactory)
```

**TypeScript (vitest/jest)**:
```typescript
// tests/fixtures/factories.ts
export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: crypto.randomUUID(),
    name: `User-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    role: 'member',
    status: 'active',
    ...overrides,
  }
}
```

Factory design rules:
- Every field has a sensible default
- Overrides via parameter for custom scenarios
- Unique values use sequence/timestamp to avoid collisions
- Relationships lazy-loaded to avoid circular dependencies

### Step 2: Define Scenario Data Sets

Create named scenarios for common test needs:

| Scenario | Description | Entities |
|----------|-------------|----------|
| `happy_path` | Standard success flow | Valid user + valid project |
| `empty_state` | No data exists | No records |
| `boundary_max` | At limits | Max-length names, max items |
| `boundary_min` | Minimal valid | Single char, single item |
| `error_invalid` | Invalid data | Missing required, bad format |
| `concurrent` | Multi-user | 2+ users acting on same resource |

### Step 3: Data Isolation Strategy

Define how tests stay independent:

**Option A: Transaction Rollback** (recommended for DB tests)
- Each test runs in a transaction that rolls back after
- Fast, no cleanup needed
- Requires: test framework transaction support

**Option B: Test Database** (for integration tests)
- Separate DB per test run (SQLite in-memory or Docker)
- Complete isolation, slower setup

**Option C: Namespace Isolation** (for shared services)
- Prefix all test data with unique run ID
- Cleanup via prefix filter after run

Recommend the best option based on project's tech stack and test types.

### Step 4: Output

Generate fixture code files to `{fixtures_dir}/`.

Generate strategy document:

```markdown
# Test Data Strategy — {project_name}

## Domain Entities
[Entity list with fields and relationships]

## Fixture Factories
[Factory code location and usage examples]

## Scenario Data Sets
[Table of scenarios with description]

## Isolation Strategy
[Chosen approach with rationale]

## Usage Examples
[How to use factories in actual tests]
```

## Keep It Simple

**Do:**

- Match the project's existing test patterns and conventions
- Keep factories minimal — only default what's needed
- Use realistic but deterministic data (avoid random in assertions)
- Document how to use the factories with 2-3 examples

**Avoid:**

- Over-engineering factory composition chains
- Creating fixtures for entities that don't need them
- Using random data that makes test failures hard to reproduce
- Depending on specific database state existing before tests run

## Output

Save strategy to: `{output_file}`
Save fixtures to: `{fixtures_dir}/`

**Done!** Test data infrastructure created. Validate against `./checklist.md`.
