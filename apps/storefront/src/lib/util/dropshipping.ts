import { HttpTypes } from "@medusajs/types"

/**
 * Dropshipping — produse cu livrare gratuită, fără AWB, în 7–10 zile.
 *
 * Un produs e în dropshipping când are profilul de livrare cu type
 * „dropshipping". Profilul are o singură opțiune de livrare, al cărei tip are
 * codul „dropship". Un coș mixt are câte o metodă de livrare pentru fiecare
 * profil.
 */
export const DROPSHIP_OPTION_TYPE_CODE = "dropship"
export const DROPSHIP_PROFILE_TYPE = "dropshipping"

// Cere `+shipping_profile.type` la produs (vezi getProductByHandle).
// (StoreProduct nu declară shipping_profile, deși Store API îl returnează.)
export function isDropshipProduct(
  product: HttpTypes.StoreProduct | null | undefined
): boolean {
  const profile = (product as { shipping_profile?: { type?: string | null } } | null)
    ?.shipping_profile
  return profile?.type === DROPSHIP_PROFILE_TYPE
}

export function isDropshipOption(
  option: HttpTypes.StoreCartShippingOption | undefined | null
): boolean {
  return (
    (option as { type?: { code?: string } } | undefined)?.type?.code ===
    DROPSHIP_OPTION_TYPE_CODE
  )
}

export function itemShippingProfileId(
  item: HttpTypes.StoreCartLineItem
): string | undefined {
  return (
    item.variant?.product as { shipping_profile?: { id?: string } } | undefined
  )?.shipping_profile?.id
}

/**
 * Profilurile de livrare de care are nevoie coșul. `null` când backendul nu a
 * trimis profilul produselor (răspuns vechi din cache) — apelanții revin atunci
 * la comportamentul de dinainte, cu o singură metodă de livrare.
 */
export function requiredShippingProfiles(
  cart: HttpTypes.StoreCart
): Set<string> | null {
  const items = (cart.items ?? []).filter((i) => i.requires_shipping !== false)
  const ids = items.map(itemShippingProfileId)
  if (!ids.length || ids.some((id) => !id)) return null
  return new Set(ids as string[])
}

/**
 * Are coșul câte o metodă de livrare pentru fiecare profil? Backendul ține cel
 * mult una per profil, deci numărul lor ajunge.
 */
export function hasAllShippingMethods(cart: HttpTypes.StoreCart): boolean {
  const count = cart.shipping_methods?.length ?? 0
  const profiles = requiredShippingProfiles(cart)
  return count >= Math.max(profiles?.size ?? 1, 1)
}
