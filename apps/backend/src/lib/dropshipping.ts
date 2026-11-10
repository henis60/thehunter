import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Dropshipping — produse cu livrare gratuită, fără AWB, în 7–10 zile.
 *
 * Un produs e în dropshipping când are profilul de livrare „Dropshipping”
 * (type `dropshipping`). Profilul se setează:
 *  - din generatorul AI (bifa „Dropshipping”, pe linie sau pe tot tabelul);
 *  - cu `npx medusa exec ./src/scripts/setup-dropshipping.ts <handle-categorie>`
 *    pentru produsele existente dintr-o categorie;
 *  - manual, din pagina produsului în Admin (Shipping profile).
 *
 * Profilul are o singură opțiune de livrare: manual (fără AWB), preț fix 0,
 * „Livrare gratuită (7–10 zile)” — creată de același script, editabilă apoi
 * din Admin → Setări → Locații și livrare.
 *
 * Un coș mixt are DOUĂ metode de livrare (câte una pe profil) — vezi
 * /store/carts/:id/profile-shipping-method. AWB-ul eAWB se generează doar
 * pentru produsele obișnuite.
 */
export const DROPSHIP_PROFILE_TYPE = "dropshipping"
export const DROPSHIP_PROFILE_NAME = "Dropshipping"
export const DROPSHIP_OPTION_TYPE_CODE = "dropship"

export type ShippingProfileIds = {
  dropship: string | null
  default: string | null
}

export async function resolveShippingProfileIds(
  container: MedusaContainer
): Promise<ShippingProfileIds> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "type", "created_at"],
  })
  const sorted = [...profiles].sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return {
    dropship: sorted.find((p: any) => p.type === DROPSHIP_PROFILE_TYPE)?.id ?? null,
    default: sorted.find((p: any) => p.type === "default")?.id ?? null,
  }
}
