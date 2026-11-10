import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveShippingProfileIds } from "../../../../lib/dropshipping"
import { EuroparcelClient } from "../../../../modules/eawb/lib/client"
import { EuroparcelApiError } from "../../../../modules/eawb/lib/errors"
import { buildContent, roundShippingPrice, toEpAddress } from "../../../../modules/eawb/lib/pricing"

// Account-level ids (from/billing) rarely change — cache them per server process.
let fromAddressId: number | null = null
let billingAddressId: number | null = null

async function getFromAddressId(client: EuroparcelClient): Promise<number | null> {
  if (fromAddressId) return fromAddressId
  const res = await client.getShippingAddresses({ all: true })
  const def = res.list?.find((a) => a.is_default) ?? res.list?.[0]
  fromAddressId = def?.id ?? null
  return fromAddressId
}

async function getBillingAddressId(client: EuroparcelClient): Promise<number | null> {
  if (billingAddressId) return billingAddressId
  const res = await client.getBillingAddresses({ all: true })
  billingAddressId = res.list?.[0]?.id ?? null
  return billingAddressId
}

/**
 * Returns live courier prices for ALL eAWB shipping options in a single call.
 * Europarcel's price endpoint, queried with carrier_id/service_id = 0, returns
 * every available carrier/service for the route at once — so the storefront
 * needs one request instead of one per option.
 *
 * GET /store/eawb/shipping-prices?cart_id=...
 * → { prices: { [shipping_option_id]: amount } }   (only positive prices)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.query.cart_id as string | undefined
  if (!cartId) {
    return res.status(400).json({ error: "cart_id is required" })
  }

  const apiKey = process.env.EAWB_API_KEY
  if (!apiKey) {
    return res.json({ prices: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [cart] } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "shipping_address.*",
      "items.id",
      "items.quantity",
      "items.variant.product.shipping_profile.id",
    ],
    filters: { id: cartId },
  })

  const shippingAddress = cart?.shipping_address as unknown as
    | Record<string, unknown>
    | null
  if (!shippingAddress?.city) {
    return res.json({ prices: {} })
  }

  // Doar produsele care pleacă efectiv cu curierul: cele în dropshipping au
  // livrare separată, gratuită, de la furnizor.
  const { dropship } = await resolveShippingProfileIds(req.scope)
  const courierItems = ((cart.items ?? []) as any[]).filter(
    (i) => i && (!dropship || i.variant?.product?.shipping_profile?.id !== dropship)
  )
  if (!courierItems.length) {
    return res.json({ prices: {} })
  }

  // Map carrier/service → Medusa shipping_option id.
  const fulfillmentModule = req.scope.resolve(Modules.FULFILLMENT)
  const options = await fulfillmentModule.listShippingOptions(
    { provider_id: "eawb_eawb" } as any,
    { select: ["id", "data"] }
  )
  const optionByKey = new Map<string, string>()
  for (const o of options) {
    const d = (o.data ?? {}) as { carrier_id?: number; service_id?: number }
    if (d.carrier_id != null && d.service_id != null) {
      optionByKey.set(`${d.carrier_id}_${d.service_id}`, o.id)
    }
  }

  const client = new EuroparcelClient(apiKey)

  try {
    const [fromId, billingId] = await Promise.all([
      getFromAddressId(client),
      getBillingAddressId(client),
    ])
    if (!fromId || !billingId) {
      return res.json({ prices: {} })
    }

    const result = await client.calculatePrices({
      carrier_id: 0,
      service_id: 0,
      billing_to: { billing_address_id: billingId },
      address_from: { address_from_id: fromId },
      address_to: toEpAddress(shippingAddress),
      content: buildContent(courierItems as Array<{ quantity?: number }>),
      extra: { parcel_content: "Produse" },
    })

    const prices: Record<string, number> = {}
    for (const opt of result.data ?? []) {
      const key = `${opt.carrier_id}_${opt.service_id}`
      const optionId = optionByKey.get(key)
      const total = opt.price?.total
      if (optionId && typeof total === "number" && total > 0) {
        prices[optionId] = roundShippingPrice(total)
      }
    }

    return res.json({ prices })
  } catch (err) {
    // A genuine failure calling Europarcel (timeout, auth/session expiry,
    // rate limit, transient 5xx) must NOT come back as 200 { prices: {} } —
    // that's byte-for-byte identical to "successfully checked, no courier
    // serves this address" on the storefront, which then shows "Niciun
    // curier nu livrează la această adresă" instead of a retryable error —
    // even to a customer who already has a valid, previously-confirmed
    // shipping method (e.g. a locker) selected on their cart. The
    // storefront's listEawbShippingPrices deliberately does NOT swallow a
    // thrown/non-2xx response into {} for exactly this reason; returning
    // 200 here defeated that.
    //
    // Logged here (not just returned in the response body) because the
    // storefront's own SDK client only surfaces a generic "Bad Gateway"
    // (status/statusText) for a non-2xx response — the actual Europarcel
    // error never reaches the browser or the storefront's logs, only this
    // backend's.
    const logger = req.scope.resolve("logger")
    logger.error(
      `eAWB shipping-prices failed for cart ${cartId}: ${(err as Error).message}`
    )

    // Not every failure here is transient, and treating them alike cost a real
    // order: Europarcel rejected an address with a 400 ("street name must be at
    // least 5 characters"), the storefront showed "try again", and the customer
    // retried three times — with two different addresses — against an error
    // that could never resolve itself.
    //
    // `invalid_request` means Europarcel judged the DATA, so only the customer
    // can fix it and they must be told what to change. Everything else
    // (rate_limit/server/network, but also auth/insufficient_funds, which are
    // OUR account's problem and must never be blamed on the customer's address)
    // stays a 502 the storefront presents as retryable.
    if (err instanceof EuroparcelApiError && err.kind === "invalid_request") {
      return res.status(422).json({
        error: err.message,
        code: "address_rejected",
        detail: err.detail,
      })
    }

    return res.status(502).json({ error: (err as Error).message })
  }
}
