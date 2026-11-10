import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export const isEawbProvider = (pid?: string | null) =>
  !!pid && (pid.startsWith("eawb_") || pid.startsWith("fp_eawb_"))

export type EawbOrderScope = {
  order: any | null
  // Metoda de livrare eAWB a comenzii (opțiunea + profilul ei), dacă există.
  eawb_option_id: string | null
  eawb_profile_id: string | null
  // Produsele ce pleacă cu curierul, încă nepregătite (cantitate rămasă > 0).
  remaining_items: { id: string; quantity: number }[]
}

/**
 * O comandă mixtă are două metode de livrare: eAWB pentru produsele obișnuite
 * și livrarea gratuită (manuală, fără AWB) pentru cele în dropshipping. AWB-ul
 * se emite doar pentru produsele din profilul metodei eAWB — cele în
 * dropshipping se pregătesc din butonul standard „Fulfill items” al Medusa,
 * cu opțiunea lor de livrare.
 */
export async function loadEawbOrderScope(
  container: MedusaContainer,
  orderId: string,
  extraFields: string[] = []
): Promise<EawbOrderScope> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [order] } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "items.id",
      "items.detail.quantity",
      "items.detail.fulfilled_quantity",
      "items.variant.product.shipping_profile.id",
      "shipping_methods.shipping_option_id",
      ...extraFields,
    ],
    filters: { id: orderId },
  })

  if (!order) {
    return { order: null, eawb_option_id: null, eawb_profile_id: null, remaining_items: [] }
  }

  const optionIds = (order.shipping_methods ?? [])
    .map((sm: any) => sm?.shipping_option_id)
    .filter(Boolean)

  let eawbOption: { id: string; shipping_profile_id: string } | undefined
  if (optionIds.length) {
    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
    const options = await fulfillmentModule.listShippingOptions(
      { id: optionIds },
      { select: ["id", "provider_id", "shipping_profile_id"] }
    )
    eawbOption = (options as any[]).find((o) => isEawbProvider(o.provider_id))
  }

  const remaining = (order.items ?? [])
    .filter((i: any) => {
      if (!i) return false
      // Fără metodă eAWB (comenzi vechi/manuale) nu filtrăm după profil.
      if (!eawbOption) return true
      const profile = i.variant?.product?.shipping_profile?.id
      // Un produs șters între timp nu mai are profil — îl lăsăm la curier,
      // cum era înainte de dropshipping.
      return !profile || profile === eawbOption.shipping_profile_id
    })
    .map((i: any) => ({
      id: i.id,
      quantity: (i.detail?.quantity ?? 0) - (i.detail?.fulfilled_quantity ?? 0),
    }))
    .filter((i: { quantity: number }) => i.quantity > 0)

  return {
    order,
    eawb_option_id: eawbOption?.id ?? null,
    eawb_profile_id: eawbOption?.shipping_profile_id ?? null,
    remaining_items: remaining,
  }
}
