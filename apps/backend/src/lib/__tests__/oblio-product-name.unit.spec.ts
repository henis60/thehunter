import { oblioProductName } from "../oblio-product-name"

const item = (product: Record<string, unknown>) => ({
  title: "Pantof Oxford",
  variant: { product: { title: "Pantof Oxford", ...product } },
})

describe("oblioProductName", () => {
  it("falls back to the category name when nothing has `oblio` metadata", () => {
    expect(oblioProductName(item({ categories: [{ name: "Shoes" }] }))).toEqual({
      name: "Shoes",
    })
  })

  it("uses the category's `oblio` metadata over its name", () => {
    expect(
      oblioProductName(
        item({ categories: [{ name: "Shoes", metadata: { oblio: "Pantofi" } }] })
      )
    ).toEqual({ name: "Pantofi" })
  })

  it("uses the product's `oblio` metadata over its categories", () => {
    expect(
      oblioProductName(
        item({
          metadata: { oblio: "Pantofi piele" },
          categories: [{ name: "Shoes", metadata: { oblio: "Pantofi" } }],
        })
      )
    ).toEqual({ name: "Pantofi piele" })
  })

  it("ignores blank `oblio` values and falls back", () => {
    expect(
      oblioProductName(
        item({
          metadata: { oblio: "  " },
          categories: [{ name: "Shoes", metadata: { oblio: "" } }],
        })
      )
    ).toEqual({ name: "Shoes" })
  })

  it("accepts several categories that map to the same Oblio name", () => {
    expect(
      oblioProductName(
        item({
          categories: [
            { name: "Shoes", metadata: { oblio: "Pantofi" } },
            { name: "Pantofi" },
          ],
        })
      )
    ).toEqual({ name: "Pantofi" })
  })

  it("stops on categories that map to different Oblio names", () => {
    const r = oblioProductName(
      item({ categories: [{ name: "Shoes" }, { name: "Accesorii" }] })
    )
    expect("error" in r && r.error).toMatch(/mai multe categorii/)
  })

  it("stops when there is no category and no product metadata", () => {
    const r = oblioProductName(item({ categories: [] }))
    expect("error" in r && r.error).toMatch(/nu are nicio categorie/)
  })
})
