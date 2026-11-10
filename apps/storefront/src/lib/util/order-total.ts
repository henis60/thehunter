import { HttpTypes } from "@medusajs/types"

const toNumber = (value: unknown): number | null => {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

// The account order lists (/profil, /profil/comenzi) showed every order as
// 0,00 on the live site even though the orders were paid. That couldn't be
// reproduced locally: the backend returned the right `total` there. So this
// falls back to the order summary, which Medusa stores per order and which is
// in the store API's default order fields. If `total` is missing or 0, use the
// summary's current_order_total (or the paid amount), and only show 0 if all
// of them are 0.
export const getOrderDisplayTotal = (order: HttpTypes.StoreOrder): number => {
  const total = toNumber(order.total)
  if (total) return total

  const summary = (order as any).summary as
    | Record<string, unknown>
    | null
    | undefined

  return (
    toNumber(summary?.current_order_total) ||
    toNumber(summary?.original_order_total) ||
    toNumber(summary?.paid_total) ||
    total ||
    0
  )
}
