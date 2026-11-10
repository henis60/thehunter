import { HttpTypes } from "@medusajs/types"

// The store API expands `labels` onto each fulfillment when queried via
// `*fulfillments.labels`, but @medusajs/types doesn't declare it on
// StoreOrderFulfillment — it's only typed for the admin fulfillment entity.
type FulfillmentWithLabels = HttpTypes.StoreOrderFulfillment & {
  labels?: { tracking_url?: string | null }[]
}

// First courier tracking link on the order, if any.
export const orderTrackingUrl = (order: HttpTypes.StoreOrder): string | null => {
  for (const fulfillment of (order.fulfillments ?? []) as FulfillmentWithLabels[]) {
    const url = fulfillment.labels?.[0]?.tracking_url
    if (url) return url
  }
  return null
}
