// Ordering for size option values, shared by the product page and both
// quick-add pickers so they always agree:
//   1. letter sizes in their natural order (XXS … 10XL),
//   2. then numeric sizes ascending by their leading number
//      ("39" < "39.5" < "41/42" < "100"),
//   3. then anything else, in natural (numeric-aware) text order.
// Equivalent spellings share a rank (XXL == 2XL, XXXL == 3XL, …).
const LETTER_RANK: Record<string, number> = {
  XXXS: 0,
  "3XS": 0,
  XXS: 1,
  "2XS": 1,
  XS: 2,
  S: 3,
  M: 4,
  L: 5,
  XL: 6,
  XXL: 7,
  "2XL": 7,
  XXXL: 8,
  "3XL": 8,
  "4XL": 9,
  "5XL": 10,
  "6XL": 11,
  "7XL": 12,
  "8XL": 13,
  "9XL": 14,
  "10XL": 15,
}

const LEADING_NUMBER = /^\s*(\d+(?:[.,]\d+)?)/

function sizeKey(value: string | null | undefined): [number, number, string] {
  const v = (value ?? "").trim()
  const letter = LETTER_RANK[v.toUpperCase()]
  if (letter !== undefined) return [0, letter, v]
  const num = v.match(LEADING_NUMBER)
  if (num) return [1, parseFloat(num[1].replace(",", ".")), v]
  return [2, 0, v]
}

export function compareSizeValues(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const [ag, an, as] = sizeKey(a)
  const [bg, bn, bs] = sizeKey(b)
  if (ag !== bg) return ag - bg
  if (an !== bn) return an - bn
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" })
}
