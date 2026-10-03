import { Inject, Injectable, Module } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { getDataSourceToken } from "@nestjs/typeorm"
import { type DataSource } from "typeorm"

import { ManagedDataSourceModule } from "./managed-datasource.module"
import { Post } from "./post.entity"
import { User } from "./user.entity"

import { managedDataSourceInstance } from "./index"

const targetsOf = (ds: { entityMetadatas: { target: unknown }[] }): unknown[] =>
  ds.entityMetadatas.map((metadata) => metadata.target)

describe("ManagedDataSourceModule", () => {
  describe("forRoot()", () => {
    describe("when imported into a Test module", () => {
      it("resolves an initialised DataSource under getDataSourceToken()", async () => {
        const module = await Test.createTestingModule({
          imports: [ManagedDataSourceModule.forRoot([User])],
        }).compile()

        const ds = module.get<DataSource>(getDataSourceToken())

        expect({
          isInitialized: ds.isInitialized,
          targets: targetsOf(ds),
        }).toEqual({ isInitialized: true, targets: [User] })
      })

      it("registers only the entities passed to forRoot", async () => {
        const module = await Test.createTestingModule({
          imports: [ManagedDataSourceModule.forRoot([Post])],
        }).compile()

        const ds = module.get<DataSource>(getDataSourceToken())

        expect(targetsOf(ds)).toEqual([Post])
      })
    })

    describe("global scope", () => {
      it("exposes the dataSource to downstream modules without re-import", async () => {
        @Injectable()
        class InjectingService {
          public constructor(
            @Inject(getDataSourceToken()) public readonly ds: DataSource,
          ) {}
        }

        @Module({
          providers: [InjectingService],
          exports: [InjectingService],
        })
        class ConsumerModule {}

        const module = await Test.createTestingModule({
          imports: [ManagedDataSourceModule.forRoot([User]), ConsumerModule],
        }).compile()

        const injecting = module.get(InjectingService)
        const tokenDs = module.get<DataSource>(getDataSourceToken())

        expect(injecting.ds).toBe(tokenDs)
      })
    })

    describe("cache reuse within a test", () => {
      it("yields the same DataSource instance as managedDataSourceInstance for the same entities", async () => {
        const module = await Test.createTestingModule({
          imports: [ManagedDataSourceModule.forRoot([User])],
        }).compile()

        const fromModule = module.get<DataSource>(getDataSourceToken())
        const direct = await managedDataSourceInstance([User])

        expect(fromModule).toBe(direct)
      })
    })

    describe("without entities argument", () => {
      it("auto-discovers entities under src/**/*.entity.ts", async () => {
        const module = await Test.createTestingModule({
          imports: [ManagedDataSourceModule.forRoot()],
        }).compile()

        const ds = module.get<DataSource>(getDataSourceToken())
        const targets = targetsOf(ds)

        expect(targets).toIncludeAllMembers([User, Post])
      })
    })
  })
})
