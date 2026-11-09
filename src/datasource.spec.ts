import { Post } from "./post.entity"
import { User } from "./user.entity"

import { managedDataSourceInstance } from "./index"

const targetsOf = (ds: { entityMetadatas: { target: unknown }[] }): unknown[] =>
  ds.entityMetadatas.map((metadata) => metadata.target)

describe("managedDataSourceInstance", () => {
  describe("with the default entities (src glob)", () => {
    it("loads all the project's entities", async () => {
      const ds = await managedDataSourceInstance()
      expect(targetsOf(ds)).toIncludeSameMembers([User, Post])
    })

    it("returns the cached instance for the same config within a test", async () => {
      expect(await managedDataSourceInstance()).toBe(
        await managedDataSourceInstance(),
      )
    })
  })

  describe("given NEOMA_MANAGED_DATASOURCE_ENTITIES names a glob", () => {
    beforeEach(() => {
      process.env.NEOMA_MANAGED_DATASOURCE_ENTITIES = "src/post.entity.ts"
    })

    afterEach(() => {
      delete process.env.NEOMA_MANAGED_DATASOURCE_ENTITIES
    })

    it("loads only the entities matching it by default", async () => {
      const ds = await managedDataSourceInstance()
      expect(targetsOf(ds)).toEqual([Post])
    })

    it("is overridden by entities passed in", async () => {
      const ds = await managedDataSourceInstance([User])
      expect(targetsOf(ds)).toEqual([User])
    })
  })

  describe("given NEOMA_MANAGED_DATASOURCE_ENTITIES is empty", () => {
    beforeEach(() => {
      process.env.NEOMA_MANAGED_DATASOURCE_ENTITIES = ""
    })

    afterEach(() => {
      delete process.env.NEOMA_MANAGED_DATASOURCE_ENTITIES
    })

    it("loads the default entities", async () => {
      const ds = await managedDataSourceInstance()
      expect(targetsOf(ds)).toIncludeSameMembers([User, Post])
    })
  })

  describe("given an explicit array of entity classes", () => {
    it("registers only those entities", async () => {
      const ds = await managedDataSourceInstance([User])
      expect(targetsOf(ds)).toEqual([User])
    })
  })

  describe("given an explicit glob", () => {
    it("loads only the entities matching the glob", async () => {
      const ds = await managedDataSourceInstance(["src/post.entity.ts"])
      expect(targetsOf(ds)).toEqual([Post])
    })
  })

  describe("caches distinct instances per config", () => {
    it("returns different instances for different entity sets", async () => {
      const users = await managedDataSourceInstance([User])
      const posts = await managedDataSourceInstance([Post])
      expect(users).not.toBe(posts)
    })

    it("registers the entities requested by each cache key", async () => {
      const users = await managedDataSourceInstance([User])
      const posts = await managedDataSourceInstance([Post])
      expect({
        users: targetsOf(users),
        posts: targetsOf(posts),
      }).toEqual({ users: [User], posts: [Post] })
    })
  })
})
