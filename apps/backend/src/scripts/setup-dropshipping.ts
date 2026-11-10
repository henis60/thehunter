import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  DROPSHIP_OPTION_TYPE_CODE,
  DROPSHIP_PROFILE_NAME,
  DROPSHIP_PROFILE_TYPE,
  resolveShippingProfileIds,
} from "../lib/dropshipping"

const MANUAL_PROVIDER_ID = "manual_manual"
const OPTION_NAME = "Livrare gratuită (7–10 zile)"

/**
 * Pregătește dropshipping-ul. Idempotent — se poate rula oricând din nou.
 *
 *   npx medusa exec ./src/scripts/setup-dropshipping.ts [handle-categorie ...]
 *
 *  1. creează profilul de livrare „Dropshipping” (dacă lipsește);
 *  2. creează opțiunea „Livrare gratuită (7–10 zile)” — furnizor
 *     manual (fără AWB), preț fix 0 RON — în fiecare zonă de livrare în care
 *     există deja opțiuni eAWB;
 *  3. pune profilul „Dropshipping” pe produsele din categoriile date ca
 *     argumente (inclusiv subcategoriile lor).
 *
 * E o operație punctuală: produsele adăugate ulterior în categorie NU primesc
 * profilul automat — se bifează „Dropshipping” în generatorul AI, se setează
 * manual din pagina produsului, sau se rulează din nou scriptul.
 *
 * Numele/prețul opțiunii se pot schimba ulterior din Admin → Setări → Locații
 * și livrare, fără redeploy.
 */
export default async function setupDropshipping({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  // ── 1. Profil ──────────────────────────────────────────────────────────────
  let { dropship: profileId } = await resolveShippingProfileIds(container)
  if (profileId) {
    logger.info(`[dropship] profilul există deja (${profileId}).`)
  } else {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: DROPSHIP_PROFILE_NAME, type: DROPSHIP_PROFILE_TYPE }] },
    })
    profileId = result[0].id
    logger.info(`[dropship] profil creat: ${profileId}`)
  }

  // ── 2. Opțiunea de livrare ─────────────────────────────────────────────────
  const { data: allOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "shipping_profile_id", "service_zone_id"],
  })

  const zoneIds = new Set(
    (allOptions as any[])
      .filter((o) => (o.provider_id ?? "").includes("eawb"))
      .map((o) => o.service_zone_id)
  )
  if (!zoneIds.size) {
    // Fără eAWB (dev local fără cheie): orice zonă de livrare existentă.
    const { data: zones } = await query.graph({
      entity: "service_zone",
      fields: ["id", "fulfillment_set.type"],
    })
    for (const z of zones as any[]) {
      if (z.fulfillment_set?.type !== "pickup") zoneIds.add(z.id)
    }
  }
  if (!zoneIds.size) {
    logger.error("[dropship] nu există nicio zonă de livrare — creeaz-o din Admin întâi.")
    return
  }

  // Furnizorul manual trebuie activat pe locația de stoc a zonei.
  const { data: zones } = await query.graph({
    entity: "service_zone",
    fields: [
      "id",
      "name",
      "fulfillment_set.location.id",
      "fulfillment_set.location.fulfillment_providers.id",
    ],
    filters: { id: Array.from(zoneIds) },
  })

  for (const zone of zones as any[]) {
    const location = zone.fulfillment_set?.location
    if (location?.id) {
      const providers = (location.fulfillment_providers ?? []).map((p: any) => p.id)
      if (!providers.includes(MANUAL_PROVIDER_ID)) {
        await link.create({
          [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: MANUAL_PROVIDER_ID },
        })
        logger.info(`[dropship] furnizor manual activat pe locația ${location.id}.`)
      }
    }

    const exists = (allOptions as any[]).some(
      (o) => o.service_zone_id === zone.id && o.shipping_profile_id === profileId
    )
    if (exists) {
      logger.info(`[dropship] zona „${zone.name}” are deja opțiune de dropshipping.`)
      continue
    }

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: OPTION_NAME,
          service_zone_id: zone.id,
          shipping_profile_id: profileId!,
          provider_id: MANUAL_PROVIDER_ID,
          price_type: "flat",
          type: {
            label: "Dropshipping",
            description: "Livrare gratuită, în 7–10 zile",
            code: DROPSHIP_OPTION_TYPE_CODE,
          },
          prices: [{ currency_code: "ron", amount: 0 }],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info(`[dropship] opțiune „${OPTION_NAME}” creată în zona „${zone.name}”.`)
  }

  // ── 3. Produsele din categorii ─────────────────────────────────────────────
  const handles = (args ?? []).filter(Boolean)
  if (!handles.length) {
    logger.info("[dropship] gata — nicio categorie dată, niciun produs modificat.")
    return
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "handle",
      "products.id",
      "products.shipping_profile.id",
      "category_children.products.id",
      "category_children.products.shipping_profile.id",
      "category_children.category_children.products.id",
      "category_children.category_children.products.shipping_profile.id",
    ],
    filters: { handle: handles },
  })
  const found = new Set((categories as any[]).map((c) => c.handle))
  for (const h of handles) {
    if (!found.has(h)) logger.warn(`[dropship] categoria „${h}” nu există.`)
  }

  const collect = (cat: any, out: Map<string, string | undefined>) => {
    if (!cat) return
    for (const p of cat.products ?? []) {
      if (p?.id) out.set(p.id, p.shipping_profile?.id)
    }
    for (const child of cat.category_children ?? []) collect(child, out)
  }
  const products = new Map<string, string | undefined>()
  for (const c of categories as any[]) collect(c, products)

  const toMove = Array.from(products.entries())
    .filter(([, current]) => current !== profileId)
    .map(([id]) => id)

  if (toMove.length) {
    await updateProductsWorkflow(container).run({
      input: {
        products: toMove.map((id) => ({ id, shipping_profile_id: profileId! })),
      },
    })
  }
  logger.info(
    `[dropship] gata — ${toMove.length} produs(e) mutate pe profilul „Dropshipping” ` +
      `(${products.size - toMove.length} îl aveau deja).`
  )
}
