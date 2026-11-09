import { DataSource, type DataSourceOptions } from "typeorm"

/** Default entities glob — every `.entity.ts` file under `src`. */
const DEFAULT_ENTITIES: DataSourceOptions["entities"] = ["src/**/*.entity.ts"]

/**
 * The entities to register when none are passed: the glob in
 * `NEOMA_MANAGED_DATASOURCE_ENTITIES` if it's set, otherwise every
 * `.entity.ts` file under `src`. Read on each call, so a spec may set it in a
 * `beforeEach`.
 *
 * @returns The entities to register.
 */
const defaultEntities = (): DataSourceOptions["entities"] => {
  const glob = process.env.NEOMA_MANAGED_DATASOURCE_ENTITIES
  return glob ? [glob] : DEFAULT_ENTITIES
}

/**
 * Create a new dataSource for testing that uses an in-memory SQLite database.
 *
 * @param entities - TypeORM entities to register: an array of globs or entity
 *   classes. Defaults to the glob in `NEOMA_MANAGED_DATASOURCE_ENTITIES`, or
 *   every `.entity.ts` file under `src` if that isn't set.
 * @returns An initialized dataSource.
 */
export const dataSource = async (
  entities: DataSourceOptions["entities"] = defaultEntities(),
): Promise<DataSource> => {
  const dataSource = new DataSource({
    type: "better-sqlite3",
    database: ":memory:",
    entities,
    synchronize: true,
  })
  return dataSource.initialize()
}

// Cache of datasources for the current test, keyed by their entities config so
// that distinct configs get distinct instances while repeated calls with the
// same config (within a test) reuse one. Cleared after each test. Mirrors the
// instance-cache pattern in @neomaventures/managed-app.
const datasourceInstances: Record<string, DataSource> = {}

afterEach(async () => {
  for (const key in datasourceInstances) {
    await datasourceInstances[key].destroy()
    delete datasourceInstances[key]
  }
})

const cacheKey = (entities: DataSourceOptions["entities"]): string =>
  JSON.stringify(entities, (_key, value: unknown) =>
    typeof value === "function" ? value.name : value,
  )

/**
 * Provides a managed in-memory SQLite dataSource for testing, cached per
 * entities config and torn down after each test.
 *
 * The first call for a given config (within a test) creates and initialises the
 * dataSource; subsequent calls with the same config return the cached instance.
 * Different configs get isolated instances. All are destroyed after each test.
 *
 * @param entities - TypeORM entities to register: an array of globs or entity
 *   classes. Defaults to the glob in `NEOMA_MANAGED_DATASOURCE_ENTITIES`, or
 *   every `.entity.ts` file under `src` if that isn't set.
 *
 * @example
 * ```typescript
 * const ds = await managedDataSourceInstance(["e2e/app/x.entity.ts"])
 * const repo = ds.getRepository(User)
 * ```
 *
 * @returns A Promise resolving to the {@link DataSource} for this config.
 */
export const managedDataSourceInstance = async (
  entities: DataSourceOptions["entities"] = defaultEntities(),
): Promise<DataSource> => {
  const key = cacheKey(entities)

  let instance = datasourceInstances[key]
  if (!instance) {
    instance = await dataSource(entities)
    datasourceInstances[key] = instance
  }

  return instance
}
