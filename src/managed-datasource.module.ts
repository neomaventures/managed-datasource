import { type DynamicModule, Module } from "@nestjs/common"
import { getDataSourceToken } from "@nestjs/typeorm"
import { type DataSource, type DataSourceOptions } from "typeorm"

import { managedDataSourceInstance } from "./managed-datasource"

/**
 * A `@Global()` NestJS test module that exposes a managed in-memory SQLite
 * `DataSource` under TypeORM's standard `getDataSourceToken()`, sharing the
 * per-test cache + `afterEach` teardown of {@link managedDataSourceInstance}.
 *
 * Global by design — this is a test fixture, not production code. The test
 * scope is small and visible (everything in `Test.createTestingModule.imports`
 * is right at the call site), and the global flag is what makes the dataSource
 * reachable by `@Global()` modules under test (e.g. `StorageModule`) whose
 * internals inject it across the global boundary.
 */
@Module({})
export class ManagedDataSourceModule {
  /**
   * Wires the managed test dataSource into a NestJS testing module.
   *
   * @param entities - TypeORM entities to register on the dataSource.
   *   Optional — defaults to the glob in `NEOMA_MANAGED_DATASOURCE_ENTITIES`, or
   *   every `.entity.ts` file under the consumer's `src/` (as
   *   `managedDataSourceInstance` does).
   * @returns A `DynamicModule` exporting the `DataSource` under
   *   `getDataSourceToken()`, visible globally.
   *
   * @example
   * ```typescript
   * // Explicit — register only the entities this test needs:
   * ManagedDataSourceModule.forRoot([TestFile])
   *
   * // Default — auto-discover all `.entity.ts` files under src/:
   * ManagedDataSourceModule.forRoot()
   * ```
   */
  public static forRoot(
    entities?: DataSourceOptions["entities"],
  ): DynamicModule {
    return {
      module: ManagedDataSourceModule,
      global: true,
      providers: [
        {
          provide: getDataSourceToken(),
          useFactory: (): Promise<DataSource> =>
            managedDataSourceInstance(entities),
        },
      ],
      exports: [getDataSourceToken()],
    }
  }
}
