import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isEawbProvider, loadEawbOrderScope } from "../../../../../lib/eawb-order"

/**
 * Everything the order-page eAWB widget needs, computed server-side so it
 * doesn't depend on the admin order endpoint's default field set.
 *
 * `remaining_items` counts only products that leave with the courier: in a
 * mixed order the dropshipping products have their own free, AWB-less shipping
 * method and are fulfilled through Medusa's standard "Fulfill items" flow.
 *
 * GET /admin/eawb/order-status/:id
 * → { uses_eawb, remaining_items, fulfillments: [{ id, data, canceled_at, shipped_at }] }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params as { id: string }

  const { order, eawb_option_id, remaining_items } = await loadEawbOrderScope(
    req.scope,
    id,
    [
      "fulfillments.id",
      "fulfillments.provider_id",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.data",
    ]
  )

  if (!order) {
    return res.status(404).json({ error: "Comanda nu a fost găsită." })
  }

  const usesEawb =
    !!eawb_option_id ||
    (order.fulfillments ?? []).some((f: any) => isEawbProvider(f?.provider_id))

  const remainingItems = remaining_items.reduce((sum, i) => sum + i.quantity, 0)

  const fulfillments = (order.fulfillments ?? [])
    .filter((f: any) => isEawbProvider(f?.provider_id) && !f?.canceled_at)
    .map((f: any) => ({
      id: f.id,
      data: f.data,
      canceled_at: f.canceled_at,
      shipped_at: f.shipped_at ?? null,
      delivered_at: f.delivered_at ?? null,
    }))

  return res.json({
    uses_eawb: usesEawb,
    remaining_items: remainingItems,
    fulfillments,
  })
}
