import { describe, expect, it } from "vitest"
import { reorderListToSimilarAsBefore } from "./util"

describe("function reorderListToSimilarAsBefore", () => {
  describe("having the same list", () => {
    it("should give expected order", () => {
      const old = ["a", "c", "b", "e", "d"]
      const updated = ["a", "b", "c", "d", "e"]

      const res = reorderListToSimilarAsBefore(old, updated, (it) => it)
      expect(res).toStrictEqual(old)
    })
  })

  describe("having extra items in updated list", () => {
    it("should give expected order", () => {
      const old = ["a", "c", "b", "e"]
      const updated = ["a", "b", "c", "d", "e"]

      const res = reorderListToSimilarAsBefore(old, updated, (it) => it)
      expect(res).toStrictEqual(["a", "c", "b", "d", "e"])
    })
  })

  describe("different list", () => {
    it("should give expected order", () => {
      const old = ["a", "c", "b", "d"]
      const updated = ["g", "h", "i", "x"]

      const res = reorderListToSimilarAsBefore(old, updated, (it) => it)
      expect(res).toStrictEqual(["g", "h", "i", "x"])
    })
  })

  describe("with duplicate keys", () => {
    it("should give expected order", () => {
      const old = ["a", "c", "b", "b"]
      const updated = ["a", "c", "b", "b"]

      const res = reorderListToSimilarAsBefore(old, updated, (it) => it)
      expect(res).toStrictEqual(["a", "c", "b", "b"])
    })
  })
})
