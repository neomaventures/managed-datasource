# @neomaventures/managed-datasource

A managed database fixture for NestJS integration testing with TypeORM. Automatically handles in-memory SQLite database lifecycle for Jest tests.

[![npm version](https://img.shields.io/npm/v/%40neomaventures%2Fmanaged-datasource)](https://www.npmjs.com/package/@neomaventures/managed-datasource)
[![CI](https://github.com/neomaventures/managed-datasource/actions/workflows/ci.yml/badge.svg)](https://github.com/neomaventures/managed-datasource/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Motivation

Integration testing NestJS applications with TypeORM requires setting up and tearing down database connections for each test. This package eliminates the boilerplate by:

- Automatically managing a single DataSource instance across tests
- Using in-memory SQLite for fast, isolated test execution
- Handling initialization and cleanup via Jest lifecycle hooks
- Auto-discovering entities from your project structure

## Problem / Solution

### Without @neomaventures/managed-datasource

```typescript
import { DataSource } from "typeorm";
import { User } from "./user.entity";
import { Post } from "./post.entity";

describe("UserRepository", () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    // Manually create and initialize dataSource for each test
    dataSource = new DataSource({
      type: "better-sqlite3",
      database: ":memory:",
      entities: [User, Post], // Must manually list all entities
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    // Manually destroy dataSource after each test
    await dataSource.destroy();
  });

  it("should create a user", async () => {
    const repo = dataSource.getRepository(User);
    // Test code...
  });
});
```

### With @neomaventures/managed-datasource

```typescript
import { managedDataSourceInstance } from "@neomaventures/managed-datasource";
import { User } from "./user.entity";

describe("UserRepository", () => {
  it("should create a user", async () => {
    // Get the managed instance - lifecycle handled automatically!
    const dataSource = managedDataSourceInstance();
    const repo = dataSource.getRepository(User);

    const user = await repo.save({ username: "alice" });
    expect(user.id).toBeDefined();
  });

  it("gets a fresh database for each test", async () => {
    // Each test starts with a clean database
    const dataSource = managedDataSourceInstance();
    const repo = dataSource.getRepository(User);

    const users = await repo.find();
    expect(users).toHaveLength(0); // Always starts empty
  });
});
```

## Installation

### 1. Install the package

```bash
npm install --save-dev @neomaventures/managed-datasource
```

### 2. Install peer dependencies

```bash
npm install --save-dev better-sqlite3 typeorm @nestjs/typeorm
npm install @nestjs/common @nestjs/core
```

### 3. Import in your test files

```typescript
import { managedDataSourceInstance } from "@neomaventures/managed-datasource";
```

That's it! The package automatically registers Jest hooks when imported, so your database lifecycle is managed automatically.

## Basic Usage

### Repository Testing

```typescript
import { managedDataSourceInstance } from "@neomaventures/managed-datasource";
import { User } from "./user.entity";

describe("User Repository", () => {
  it("should create and retrieve users", async () => {
    const dataSource = managedDataSourceInstance();
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.save({
      username: "alice",
    });

    const found = await userRepo.findOne({ where: { id: user.id } });
    expect(found.username).toBe("alice");
  });
});
```

### Testing Services

```typescript
import { managedDataSourceInstance } from "@neomaventures/managed-datasource";
import { UserService } from "./user.service";
import { User } from "./user.entity";

describe("UserService", () => {
  let service: UserService;

  beforeEach(() => {
    const dataSource = managedDataSourceInstance();
    service = new UserService(dataSource.getRepository(User));
  });

  it("should create users", async () => {
    const user = await service.create({ username: "alice" });
    expect(user.id).toBeDefined();
  });
});
```

### Using with NestJS test modules

`ManagedDataSourceModule.forRoot(entities)` returns a `@Global()` dynamic
module that exposes the managed dataSource under TypeORM's standard
`getDataSourceToken()`, sharing the same per-test cache + teardown as
`managedDataSourceInstance`. Global by design: this is a test fixture,
and global is what makes the dataSource reachable from `@Global()`
modules under test (e.g. `StorageModule`) whose internals inject it
across the global boundary.

```typescript
import { ManagedDataSourceModule } from "@neomaventures/managed-datasource";
import { Test } from "@nestjs/testing";

import { TestFile } from "./test-file.entity";
import { StorageModule } from "./storage.module";

describe("StorageModule", () => {
  it("compiles", async () => {
    const module = await Test.createTestingModule({
      imports: [
        ManagedDataSourceModule.forRoot([TestFile]),
        StorageModule.forRoot(options),
      ],
    }).compile();

    expect(module).toBeDefined();
  });
});
```

## API Reference

### `managedDataSourceInstance(): DataSource`

Returns the managed DataSource instance for the current test.

**Returns:** `DataSource` - A TypeORM DataSource instance configured with in-memory SQLite

**Lifecycle:**

- Automatically initialized before each test via `beforeEach` hook
- Automatically destroyed after each test via `afterEach` hook
- Returns the same instance within a single test
- Returns a fresh instance for each new test

**Example:**

```typescript
const dataSource = managedDataSourceInstance();
const repo = dataSource.getRepository(User);
```

**Note:** The lifecycle hooks are registered automatically when you import anything from this package, so you don't need to call any setup functions.

### `dataSource(): Promise<DataSource>`

Low-level function to create a new DataSource instance. Used internally by `managedDataSourceInstance()`.

**Returns:** `Promise<DataSource>` - A new, initialized DataSource instance

**Configuration:**

- Type: SQLite
- Database: In-memory (`:memory:`)
- Entities: from `NEOMA_MANAGED_DATASOURCE_ENTITIES` if set, otherwise auto-discovered from `src/**/*.entity.ts`
- Synchronize: Enabled (auto-creates schema)

### `ManagedDataSourceModule.forRoot(entities?): DynamicModule`

Wires the managed test dataSource into a NestJS testing module. Exposes the `DataSource` under `getDataSourceToken()`, globally.

**Parameters:**

- `entities` _(optional)_ — TypeORM entity classes to register on the dataSource. Omit to use `NEOMA_MANAGED_DATASOURCE_ENTITIES`, or to auto-discover every `.entity.ts` file under the consumer's `src/`.

**Returns:** `DynamicModule` — a `@Global()` dynamic module exporting `getDataSourceToken()`.

**Lifecycle:**

- The provider's `useFactory` delegates to `managedDataSourceInstance(entities)`, so the per-test cache and `afterEach` teardown remain authoritative.
- Repeated calls with the same `entities` inside one test resolve to the same underlying `DataSource` (cache hit).

**Example:**

```typescript
// Explicit — register only the entities this test needs:
imports: [ManagedDataSourceModule.forRoot([User])];

// Default — auto-discover all `.entity.ts` files under src/:
imports: [ManagedDataSourceModule.forRoot()];
```

## Configuration

### Entity Discovery

Entities are resolved in order of precedence:

1. **Function parameter:** the `entities` passed to `managedDataSourceInstance()`, `dataSource()` or `ManagedDataSourceModule.forRoot()`.
2. **Environment variable:** `NEOMA_MANAGED_DATASOURCE_ENTITIES`, a single glob.
3. **Default:** `src/**/*.entity.ts`.

#### `NEOMA_MANAGED_DATASOURCE_ENTITIES`

A glob for the entities to register when none are passed, for projects whose entities aren't under `src/`, such as a Nest monorepo:

```bash
# .env.spec — quoted, since some env loaders treat # and braces specially
NEOMA_MANAGED_DATASOURCE_ENTITIES="{apps,libs}/**/*.entity.ts"
```

It's read on each call, so a spec may also set it in a `beforeEach`. Unset or empty, the default applies.

Without either, the package discovers entities from:

```
src/**/*.entity.ts
```

This pattern will find all entity files in your `src` directory and subdirectories. Ensure your entities:

1. Use the `.entity.ts` naming convention
2. Are located under the `src/` directory
3. Export classes decorated with `@Entity()`

**Example Structure:**

```
src/
├── user.entity.ts
├── post.entity.ts
└── modules/
    └── auth/
        └── session.entity.ts
```

All three entities (User, Post, Session) will be automatically discovered.

### Database Configuration

The package uses the following TypeORM configuration:

```typescript
{
  type: "better-sqlite3",
  database: ":memory:",
  entities: ["src/**/*.entity.ts"],
  synchronize: true,
}
```

**Key Features:**

- **SQLite In-Memory:** Each test gets a completely isolated database
- **Auto-Sync:** Schema is automatically created from your entities
- **Fast:** In-memory databases are extremely fast for testing
- **Clean State:** Every test starts with a fresh, empty database

## Why SQLite In-Memory?

Testing with SQLite in-memory provides several advantages:

1. **Speed:** Orders of magnitude faster than traditional databases
2. **Isolation:** Each test gets a completely independent database
3. **Portability:** No external database setup required
4. **CI/CD Friendly:** Works out of the box in any environment
5. **Consistency:** Deterministic test behavior

## Requirements

- Node.js >= 22.0.0
- Jest testing framework
- TypeScript >= 5.0
- NestJS >= 11.0
- TypeORM >= 0.3

## Links

- [npm package](https://www.npmjs.com/package/@neomaventures/managed-datasource)
- [GitHub repository](https://github.com/neomaventures/managed-datasource)
- [Report Issues](https://github.com/neomaventures/managed-datasource/issues)

## Related Packages

- [@neomaventures/managed-app](https://www.npmjs.com/package/@neomaventures/managed-app) - Managed NestJS app instances for E2E testing

## License

MIT

---

Built with love by [neomaventures](https://github.com/neomaventures) for the NestJS community.
