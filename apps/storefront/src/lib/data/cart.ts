"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { orderIdToSlug } from "@lib/util/order-slug"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "@i18n/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { getRegion } from "./regions"
import { getLocale } from "./locale-actions"
import { getMedusaLocaleHeaders } from "@lib/util/request-locale"
import { normalizePhone } from "@lib/util/phone"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @param fields - optional - Field selection override.
 * @param locale - optional - Required when called as a Server Action from a
 *   Client Component (e.g. the nav CartButton, which fetches on mount) —
 *   there's no route [locale] param there to derive it from, so pass the
 *   client's current locale (next-intl's useLocale()) explicitly.
 * @returns The cart object if found, or null if not found.
 */
const DEFAULT_CART_FIELDS =
  "*items, *region, *items.variant, +items.variant.thumbnail, +items.variant.inventory_quantity, +items.variant.manage_inventory, +items.variant.allow_backorder, *items.variant.images, +items.variant.options, +items.variant.options.option, *items.variant.product, +items.variant.product.thumbnail, *items.variant.product.images, +items.variant.product.options, +items.variant.product.options.values, *items.variant.product.variants, *items.variant.product.variants.options, *items.variant.product.variants.images, *items.thumbnail, *items.metadata, +items.total, +items.original_total, +items.compare_at_unit_price, *promotions, +shipping_methods.name, +shipping_methods.shipping_option_id, +items.variant.product.shipping_profile.id, *payment_collection, +payment_collection.payment_sessions"

// A misconfigured promotion (e.g. a campaign budget requiring a customer
// attribute the cart doesn't have yet) can make Medusa throw while
// computing *promotions on an otherwise-valid cart — that's a data/config
// problem, not something that should 500 every page that shows a cart.
const CART_FIELDS_WITHOUT_PROMOTIONS = DEFAULT_CART_FIELDS.replace(
  "*promotions, ",
  ""
)

export async function retrieveCart(
  cartId?: string,
  fields?: string,
  locale?: string
) {
  const id = cartId || (await getCartId())
  const usedDefaultFields = fields === undefined
  fields ??= DEFAULT_CART_FIELDS

  if (!id) {
    return null
  }

  const localeHeaders = getMedusaLocaleHeaders(locale)
  const headers = {
    ...(await getAuthHeaders()),
    ...localeHeaders,
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  const fetchCart = (withFields: string) =>
    sdk.client
      .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
        method: "GET",
        query: { fields: withFields },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)

  const cart = await fetchCart(fields)
    .catch(async (error) => {
      // The cart itself is gone (deleted/expired) — not a promotions
      // config problem, so retrying without *promotions would just hit
      // the same 404 again. Clear the stale cookie so every subsequent
      // page load doesn't keep re-fetching (and re-logging) a dead cart.
      if (error?.status === 404) {
        if (!cartId) await removeCartId()
        return null
      }
      if (!usedDefaultFields) throw error
      console.error(
        "retrieveCart failed, retrying without promotions:",
        error
      )
      return fetchCart(CART_FIELDS_WITHOUT_PROMOTIONS)
    })
    .catch(() => null)

  // Medusa's translation module only applies to the top-level queried
  // entity — /store/carts/:id returns the cart itself translated, but NOT
  // the deeply nested items.variant.product relation (confirmed directly:
  // the same request with an en-GB locale header still returns the
  // Romanian product title at that path). Same limitation applies to
  // items.variant.title and items.variant.options[].value (the color/size
  // label shown under the product name in cart/drawer). /store/products
  // DOES translate correctly, so overlay real values from there instead of
  // trusting the cart response's nested product/variant data.
  if (cart?.items?.length && Object.keys(localeHeaders).length) {
    const productIds = Array.from(
      new Set(cart.items.map((item) => item.product_id).filter(Boolean))
    ) as string[]

    if (productIds.length) {
      type TranslatedProduct = {
        id: string
        title: string
        variants?: {
          id: string
          title: string
          options?: { option_id: string; value: string }[]
        }[]
      }

      const productById = await sdk.client
        .fetch<{ products: TranslatedProduct[] }>(`/store/products`, {
          method: "GET",
          query: {
            id: productIds,
            fields:
              "id,title,variants.id,variants.title,variants.options.option_id,variants.options.value",
            limit: productIds.length,
          },
          headers: { ...headers, ...localeHeaders },
        })
        .then(({ products }) => new Map(products.map((p) => [p.id, p])))
        .catch(() => new Map<string, TranslatedProduct>())

      for (const item of cart.items) {
        const translated = item.product_id
          ? productById.get(item.product_id)
          : undefined
        if (!translated) continue

        item.product_title = translated.title
        if (item.variant && (item.variant as any).product) {
          ;(item.variant as any).product.title = translated.title
        }

        const variantId = item.variant?.id
        const translatedVariant = translated.variants?.find(
          (v) => v.id === variantId
        )
        if (!translatedVariant || !item.variant) continue

        item.variant.title = translatedVariant.title
        const valueByOptionId = new Map(
          (translatedVariant.options ?? []).map((o) => [o.option_id, o.value])
        )
        for (const opt of (item.variant as any).options ?? []) {
          const translatedValue = valueByOptionId.get(opt.option_id)
          if (translatedValue) opt.value = translatedValue
        }
      }
    }
  }

  return cart
}

export async function getOrSetCart(countryCode?: string) {
  const region = await getRegion(countryCode || "ro")

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id")

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers
    )
    cart = cartResp.cart

    await setCartId(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  locale,
}: {
  variantId: string
  quantity: number
  countryCode: string
  /** See retrieveCart — required when called from a Client Component. */
  locale?: string
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers
    )
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)

  // Return the fresh cart so the client can update the badge/drawer without
  // a second server-action round-trip.
  return await retrieveCart(cart.id, undefined, locale)
}

export async function updateLineItem({
  lineId,
  quantity,
  locale,
}: {
  lineId: string
  quantity: number
  /** See retrieveCart — required when called from a Client Component. */
  locale?: string
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)

  // Fresh cart for instant client-side reconciliation (single round-trip).
  return await retrieveCart(cartId, undefined, locale)
}

export async function deleteLineItem(lineId: string, locale?: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)

  // Fresh cart for instant client-side reconciliation (single round-trip).
  return await retrieveCart(cartId, undefined, locale)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
  data,
}: {
  cartId: string
  shippingMethodId: string
  data?: Record<string, unknown>
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // Ruta custom păstrează câte o metodă per profil de livrare (curier pentru
  // produsele obișnuite + livrarea gratuită pentru cele în dropshipping);
  // addShippingMethod din SDK le-ar șterge pe celelalte.
  return sdk.client
    .fetch(`/store/carts/${cartId}/profile-shipping-method`, {
      method: "POST",
      body: { option_id: shippingMethodId, ...(data ? { data } : {}) },
      headers,
    })
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession,
  // Când plata implică un redirect extern (Netopia), utilizatorul părăsește
  // imediat aplicația. `revalidateTag` ar declanșa un refresh al rutei
  // `/checkout` (force-dynamic) care se suprapune cu `window.location` — pe
  // mobil navigarea externă e amânată, refresh-ul chiar rulează, iar dacă
  // fetch-ul RSC eșuează pe o conexiune instabilă => "client-side exception".
  // Sărim revalidarea în acel caz ca să eliminăm cursa.
  { revalidate = true }: { revalidate?: boolean } = {}
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      if (revalidate) {
        const cartCacheTag = await getCacheTag("carts")
        revalidateTag(cartCacheTag)
      }
      return resp
    })
    .catch((error) => {
      console.error("initiatePaymentSession failed:", error)
      // Not medusaError(): its axios-shaped branches (response/request) don't
      // match this SDK's plain-Error rejections, so it falls through to the
      // "Error setting up the request: " catch-all prefix — noise on top of
      // an already-clean backend message (e.g. the sandbox-mode block).
      const message =
        (error as { message?: string } | undefined)?.message ||
        "A apărut o eroare. Reîncearcă."
      return {
        error: message,
      } as unknown as HttpTypes.StorePaymentCollectionResponse
    })
}

export type NetopiaBrowserInfo = Record<string, string>

export async function initiateNetopiaPayment(
  cartId: string,
  providerId: string,
  browserInfo?: NetopiaBrowserInfo,
  // Netopia redirects the browser back cross-site — often via a POST (3DS
  // ACS callback), which browsers never attach SameSite cookies to (not even
  // "Lax", which only allows GET top-level navigations). So the storefront's
  // locale cookie can't be trusted to survive the round trip; instead we
  // stamp the locale the customer was actually using onto the redirect URL
  // itself, read back on `/finalizare-comanda/netopia/return`.
  locale?: string
): Promise<string | undefined> {
  // Trimitem doar id-urile de care are nevoie SDK-ul — coșul complet (cu toate
  // variantele/imaginile/opțiunile) ar fi serializat integral peste rețea la
  // fiecare apel al acestui Server Action, ceea ce pe conexiuni mobile poate
  // eșua cu "TypeError: Load failed" (Safari) / "Failed to fetch" (Chrome).
  const cart = { id: cartId } as HttpTypes.StoreCart

  // PaymentProviderContext (Medusa) nu include billing_address — doar
  // customer/account_holder/idempotency_key. Ca provider-ul Netopia să
  // primească telefonul/adresa reale completate la checkout, le trimitem
  // explicit prin `data`, populate server-side din coșul curent.
  const fullCart = await retrieveCart(cartId)
  const addr = fullCart?.shipping_address

  // Reuse a still-open Netopia page instead of creating a second session.
  // Creating a session makes Medusa hard-delete the cart's previous one, but
  // its Netopia page stays payable. A customer with two tabs (or who went
  // back and clicked again) could pay on the first one, and the IPN would
  // then reference a session that no longer exists: money taken, no order.
  // Only reused while fresh and for the exact current amount; a changed cart
  // always gets a new session.
  // Read uncached: retrieveCart is force-cached, and the first click skipped
  // revalidation on purpose, so the cached cart may not show its session yet.
  const freshPayment = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      query: {
        fields: "id,total,*payment_collection,*payment_collection.payment_sessions",
      },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(({ cart }) => cart)
    .catch(() => null)
  const reusable = findReusableNetopiaSession(freshPayment, providerId)
  if (reusable) return reusable

  // Server Actions that throw have their error message stripped by Next.js in
  // production (only a digest reaches the client) — including deliberate,
  // safe-to-show errors like the backend's sandbox-mode checkout block. Catch
  // here so a blocked/failed payment session surfaces as a normal `undefined`
  // return, which the caller already renders as a friendly Romanian message.
  let resp: { payment_collection?: HttpTypes.StorePaymentCollection } | undefined
  try {
    resp = (await initiatePaymentSession(cart, {
      provider_id: providerId,
      data: {
        billing_address: addr
          ? {
              email: fullCart?.email ?? undefined,
              phone: addr.phone ?? undefined,
              first_name: addr.first_name ?? undefined,
              last_name: addr.last_name ?? undefined,
              city: addr.city ?? undefined,
              postal_code: addr.postal_code ?? undefined,
              province: addr.province ?? undefined,
            }
          : undefined,
        browser_info: browserInfo,
        locale,
      },
    }, { revalidate: false })) as { payment_collection?: HttpTypes.StorePaymentCollection }
  } catch (err) {
    console.error("initiateNetopiaPayment failed:", err)
    return undefined
  }

  const session = resp?.payment_collection?.payment_sessions?.find(
    (s) => s.provider_id === providerId
  )

  return (session?.data as Record<string, unknown> | undefined)
    ?.redirect_url as string | undefined
}

// How long a Netopia payment page is treated as still payable/reusable. Kept
// conservative: an expired page would show the customer an error at Netopia,
// after which a fresh click past this window creates a new session.
const NETOPIA_REUSE_WINDOW_MS = 15 * 60 * 1000

function findReusableNetopiaSession(
  cart: HttpTypes.StoreCart | null | undefined,
  providerId: string
): string | undefined {
  const sessions = cart?.payment_collection?.payment_sessions ?? []
  const session = sessions.find(
    (s) => s.provider_id === providerId && s.status === "pending"
  )
  const data = (session?.data ?? {}) as Record<string, unknown>
  const redirectUrl = data.redirect_url
  const initiatedAt = Date.parse(String(data.initiated_at ?? ""))

  if (typeof redirectUrl !== "string" || !redirectUrl || !data.ntpID) return
  if (!Number.isFinite(initiatedAt)) return
  if (Date.now() - initiatedAt > NETOPIA_REUSE_WINDOW_MS) return

  // The session must still charge exactly what the cart now costs.
  const cartTotal = Number(cart?.total)
  const sessionAmount = Number(session?.amount)
  const netopiaAmount = Number(data.amountRON)
  if (
    !Number.isFinite(cartTotal) ||
    Math.abs(sessionAmount - cartTotal) >= 0.01 ||
    Math.abs(netopiaAmount - cartTotal) >= 0.01
  ) {
    return
  }

  return redirectUrl
}

export type NetopiaCompletion = {
  orderId?: string
  pending?: boolean
  failed?: boolean
  // The session is gone: it was replaced by a newer one for the same cart.
  stale?: boolean
}

export async function completeNetopiaCart(cartId: string): Promise<NetopiaCompletion> {
  const headers = { ...(await getAuthHeaders()) }

  try {
    const res = await sdk.store.cart.complete(cartId, {}, headers)
    if (res?.type === "order") {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      const orderCacheTag = await getCacheTag("orders")
      revalidateTag(orderCacheTag)
      await removeCartId()
      return { orderId: res.order.id }
    }
    return { pending: true }
  } catch {
    return { pending: true }
  }
}

export async function completeNetopiaBySession(sessionId: string): Promise<NetopiaCompletion> {
  const headers = { ...(await getAuthHeaders()) }

  let cartId: string | null = null
  let status: string | null = null
  try {
    const resolved = await sdk.client.fetch<{
      cart_id: string | null
      status: string | null
    }>("/store/netopia/session-cart", {
      query: { session_id: sessionId },
      headers,
    })
    cartId = resolved?.cart_id ?? null
    status = resolved?.status ?? null
  } catch {
    return { pending: true }
  }

  if (status === "error" || status === "canceled") {
    return { failed: true }
  }

  // A session always exists before the customer is sent to Netopia, so an
  // unknown id with no status means it was deleted, replaced by a later
  // "Plătește" click for the same cart. Polling would never succeed.
  if (!cartId && status === null) {
    return { stale: true }
  }

  if (!cartId) {
    return { pending: true }
  }

  return completeNetopiaCart(cartId)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    return e.message
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    const cartId = getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: normalizePhone(formData.get("shipping_address.phone")),
      },
      email: formData.get("email"),
    } as any

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address

    if (sameAsBilling !== "on")
      data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: normalizePhone(formData.get("billing_address.phone")),
      }
    await updateCart(data)
  } catch (e: any) {
    return e.message
  }

  redirect({
    href: "/finalizare-comanda?pas=livrare",
    locale: (await getLocale()) || "ro",
  })
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    removeCartId()
    redirect({
      href: `/comanda/${orderIdToSlug(cartRes.order.id)}`,
      locale: (await getLocale()) || "ro",
    })
    // redirect() throws — this is unreachable, it's only here so TS can
    // narrow cartRes to the "cart" variant below without complaining that
    // "order" doesn't have a .cart property.
    return undefined as never
  }

  return cartRes.cart
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
