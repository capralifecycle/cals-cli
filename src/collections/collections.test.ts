import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { groupBy, sortBy, sumBy, uniq } from "./collections"

describe("collections", () => {
  describe("groupBy", () => {
    type TestCase<T> = {
      description: string
      got: T[]
      iteratee: (item: T) => string
      want: Record<string, T[]>
    }
    const tests: TestCase<{ id: number }>[] = [
      {
        description: "groups items by id",
        got: [{ id: 1 }, { id: 2 }, { id: 1 }],
        iteratee: (item) => item.id.toString(),
        want: { "1": [{ id: 1 }, { id: 1 }], "2": [{ id: 2 }] },
      },
      {
        description: "groups items by id with duplicates",
        got: [{ id: 1 }, { id: 2 }, { id: 1 }],
        iteratee: (item) => item.id.toString(),
        want: { "1": [{ id: 1 }, { id: 1 }], "2": [{ id: 2 }] },
      },
      {
        description: "handles empty array",
        got: [],
        iteratee: (item) => item.id.toString(),
        want: {},
      },
      {
        description: "handles single item",
        got: [{ id: 1 }],
        iteratee: (item) => item.id.toString(),
        want: { "1": [{ id: 1 }] },
      },
      {
        description: "handles multiple unique items",
        got: [{ id: 1 }, { id: 2 }, { id: 3 }],
        iteratee: (item) => item.id.toString(),
        want: { "1": [{ id: 1 }], "2": [{ id: 2 }], "3": [{ id: 3 }] },
      },
    ]

    for (const { description, got, iteratee, want } of tests) {
      test(description, () => {
        assert.deepEqual(groupBy(got, iteratee), want)
      })
    }
  })

  describe("uniq", () => {
    type TestCase<T> = {
      description: string
      got: T[]
      want: T[]
    }
    const tests: TestCase<number>[] = [
      {
        description: "removes duplicates from array",
        got: [1, 2, 2, 3, 4, 4, 5],
        want: [1, 2, 3, 4, 5],
      },
      {
        description: "removes duplicates from array with duplicates",
        got: [1, 2, 2, 3, 4, 4, 5],
        want: [1, 2, 3, 4, 5],
      },
      {
        description: "handles empty array",
        got: [],
        want: [],
      },
      {
        description: "handles array with all same elements",
        got: [1, 1, 1, 1],
        want: [1],
      },
      {
        description: "handles array with all unique elements",
        got: [1, 2, 3, 4, 5],
        want: [1, 2, 3, 4, 5],
      },
    ]

    for (const { description, got, want } of tests) {
      test(description, () => {
        assert.deepEqual(uniq(got), want)
      })
    }
  })

  describe("sortBy", () => {
    type TestCase<T> = {
      description: string
      got: T[]
      getKey: (item: T) => string
      want: T[]
    }
    const tests: TestCase<{ name: string }>[] = [
      {
        description: "sorts items by name",
        got: [{ name: "b" }, { name: "a" }, { name: "c" }],
        getKey: (item) => item.name,
        want: [{ name: "a" }, { name: "b" }, { name: "c" }],
      },
      {
        description: "sorts items by numeric string",
        got: [{ name: "30" }, { name: "20" }, { name: "40" }],
        getKey: (item) => item.name,
        want: [{ name: "20" }, { name: "30" }, { name: "40" }],
      },
      {
        description: "handles empty array",
        got: [],
        getKey: (item) => item.name,
        want: [],
      },
      {
        description: "sorts items by numeric string with two elements",
        got: [{ name: "2" }, { name: "1" }],
        getKey: (item) => item.name,
        want: [{ name: "1" }, { name: "2" }],
      },
      {
        description: "sorts items by name with multiple elements",
        got: [{ name: "z" }, { name: "x" }, { name: "y" }],
        getKey: (item) => item.name,
        want: [{ name: "x" }, { name: "y" }, { name: "z" }],
      },
    ]

    for (const { description, got, getKey, want } of tests) {
      test(description, () => {
        assert.deepEqual(sortBy(got, getKey), want)
      })
    }
  })

  describe("sumBy", () => {
    type TestCase<T> = {
      description: string
      got: T[]
      iteratee: (item: T) => number
      want: number
    }
    const cases: TestCase<{ value: number }>[] = [
      {
        description: "sums values in array",
        got: [{ value: 1 }, { value: 2 }, { value: 3 }],
        iteratee: (item) => item.value,
        want: 6,
      },
      {
        description: "sums values in array with two elements",
        got: [{ value: 10 }, { value: 20 }],
        iteratee: (item) => item.value,
        want: 30,
      },
      {
        description: "handles empty array",
        got: [],
        iteratee: (item) => item.value,
        want: 0,
      },
      {
        description: "sums values in array with negative and positive elements",
        got: [{ value: -1 }, { value: 1 }],
        iteratee: (item) => item.value,
        want: 0,
      },
      {
        description: "sums values in array with same elements",
        got: [{ value: 5 }, { value: 5 }, { value: 5 }],
        iteratee: (item) => item.value,
        want: 15,
      },
    ]

    for (const { description, got, iteratee, want } of cases) {
      test(description, () => {
        assert.deepEqual(sumBy(got, iteratee), want)
      })
    }
  })
})
