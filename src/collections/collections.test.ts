import { groupBy, uniq, sortBy, sumBy } from "./collections"

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

    test.each(tests)(
      "$description",
      ({ got, iteratee, want }: TestCase<{ id: number }>) => {
        expect(groupBy(got, iteratee)).toEqual(want)
      },
    )
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

    test.each(tests)("$description", ({ got, want }: TestCase<number>) => {
      expect(uniq(got)).toEqual(want)
    })
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

    test.each(tests)(
      "$description",
      ({ got, getKey, want }: TestCase<{ name: string }>) => {
        expect(sortBy(got, getKey)).toEqual(want)
      },
    )
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

    test.each(cases)(
      "$description",
      ({ got, iteratee, want }: TestCase<{ value: number }>) => {
        expect(sumBy(got, iteratee)).toEqual(want)
      },
    )
  })
})
