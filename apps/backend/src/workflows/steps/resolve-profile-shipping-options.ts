import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { resolveShippingProfileIds } from "../../lib/dropshipping"

export type ResolveProfileShippingOptionsInput = {
  cart_id: string
  option_id: string
  data?: Record<string, unknown>
}

export type ProfileShippingOption = {
  id: string
  data?: Record<string, unknown>
}

/**
 * Medusa păstrează o singură metodă de livrare pe coș când e setată din Store
 * API (addShippingMethodToCartWorkflow le șterge pe toate celelalte). Un coș cu
 * produse obișnuite + produse în dropshipping are însă nevoie de câte o metodă
 * pentru fiecare profil de livrare — altfel finalizarea comenzii eșuează.
 *
 * Pasul calculează lista completă de opțiuni de trimis workflow-ului: opțiunea
 * nouă + metodele existente ale CELORLALTE profiluri încă prezente în coș.
 * Metodele pentru profiluri care nu mai au produse în coș sunt eliminate (de
 * ex. o livrare cu curier plătită rămasă după ce clientul a scos produsele
 * obișnuite).
 */
export const resolveProfileShippingOptionsStep = createStep(
  "resolve-profile-shipping-options",
  async (input: ResolveProfileShippingOptionsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "items.id",
        "items.product_id",
        "items.requires_shipping",
        "items.variant.product.shipping_profile.id",
        "shipping_methods.id",
        "shipping_methods.shipping_option_id",
        "shipping_methods.data",
      ],
      filters: { id: input.cart_id },
    })

    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Coșul ${input.cart_id} nu există.`)
    }

    const items = (cart.items ?? []).filter(Boolean) as any[]
    const requiredProfiles = new Set(
      items
        .filter((i) => i.requires_shipping !== false)
        .map((i) => i.variant?.product?.shipping_profile?.id)
        .filter(Boolean) as string[]
    )

    const methods = (cart.shipping_methods ?? []).filter(Boolean) as any[]
    const optionIds = Array.from(
      new Set([input.option_id, ...methods.map((m) => m.shipping_option_id).filter(Boolean)])
    )

    const { data: options } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "shipping_profile_id", "provider_id"],
      filters: { id: optionIds },
    })
    const profileByOption = new Map<string, string>(
      (options as any[]).map((o) => [o.id, o.shipping_profile_id])
    )
    const providerByOption = new Map<string, string>(
      (options as any[]).map((o) => [o.id, o.provider_id])
    )

    const newProfile = profileByOption.get(input.option_id)
    if (!newProfile) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Opțiunea de livrare ${input.option_id} nu există.`
      )
    }
    if (!requiredProfiles.has(newProfile)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Această metodă de livrare nu se aplică produselor din coș."
      )
    }

    // Produsele din coș livrate în dropshipping: scoase din greutatea coletului
    // eAWB (calculatePrice primește `data` metodei), ca tariful să reflecte
    // doar ce pleacă efectiv cu curierul.
    const { dropship } = await resolveShippingProfileIds(container)
    const dropshipProductIds = dropship
      ? Array.from(
          new Set(
            items
              .filter((i) => i.variant?.product?.shipping_profile?.id === dropship)
              .map((i) => i.product_id)
              .filter(Boolean) as string[]
          )
        )
      : []

    const withPricingHints = (optionId: string, data?: Record<string, unknown>) => {
      const provider = providerByOption.get(optionId) ?? ""
      if (!provider.includes("eawb")) return data ?? {}
      return { ...(data ?? {}), dropship_product_ids: dropshipProductIds }
    }

    const seenProfiles = new Set<string>([newProfile])
    const kept: ProfileShippingOption[] = []
    // Ultima metodă a fiecărui profil câștigă (ordinea inversă), ca să nu
    // dublăm niciodată un profil dacă un coș vechi avea deja duplicate.
    for (const m of [...methods].reverse()) {
      const profile = profileByOption.get(m.shipping_option_id)
      if (!profile || seenProfiles.has(profile) || !requiredProfiles.has(profile)) {
        continue
      }
      seenProfiles.add(profile)
      kept.push({
        id: m.shipping_option_id,
        data: withPricingHints(m.shipping_option_id, m.data ?? {}),
      })
    }

    const result: ProfileShippingOption[] = [
      ...kept,
      { id: input.option_id, data: withPricingHints(input.option_id, input.data) },
    ]

    return new StepResponse(result)
  }
)
