import { HttpTypes } from "@medusajs/types"

const toNumber = (value: unknown): number | null => {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

// Amount refunded to the customer as order credit lines. Medusa's refund
// (and cancel-with-refund) workflows add a credit line for the refunded
// amount, and `order.total` subtracts credit lines, so a fully refunded
// order reports total 0 while its subtotal and shipping stay the same.
export const getOrderRefundedTotal = (order: HttpTypes.StoreOrder): number =>
  toNumber((order as any).credit_line_total) ?? 0

// What the order cost: Medusa's total with the refund credit lines added
// back. Falls back to the order summary if total is missing entirely.
export const getOrderDisplayTotal = (order: HttpTypes.StoreOrder): number => {
  const total = toNumber(order.total)
  if (total != null) return total + getOrderRefundedTotal(order)

  const summary = (order as any).summary as
    | Record<string, unknown>
    | null
    | undefined
  return (
    toNumber(summary?.original_order_total) ??
    toNumber(summary?.current_order_total) ??
    0
  )
}
