"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getTranslations } from "next-intl/server"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getMedusaLocaleHeaders } from "@lib/util/request-locale"
import { HttpTypes } from "@medusajs/types"

// Medusa's translation module only applies to the top-level queried entity —
// /store/orders/:id returns the order itself translated, but NOT the deeply
// nested items.variant.product relation (same limitation documented in
// retrieveCart, cart.ts — confirmed there directly: an en-GB locale header
// still returns the Romanian product title at that nested path). /store/
// products DOES translate correctly, so overlay real values from there
// instead of trusting the order response's nested product/variant data.
async function applyProductTranslationOverlay(
  items: HttpTypes.StoreOrderLineItem[] | null | undefined,
  headers: Record<string, string>,
  localeHeaders: Record<string, string>
) {
  if (!items?.length || !Object.keys(localeHeaders).length) return

  const productIds = Array.from(
    new Set(items.map((item) => item.product_id).filter(Boolean))
  ) as string[]
  if (!productIds.length) return

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

  for (const item of items) {
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

export const retrieveOrder = async (id: string, locale?: string) => {
  // getMedusaLocaleHeaders() with no argument falls back to
  // getRequestLocaleValue(), which is only populated by [locale]/layout.tsx
  // actually re-running its function body — Next.js skips that on a
  // soft/client-side navigation between two pages under the same already-
  // mounted layout (e.g. /profil/comenzi -> /profil/comenzi/[displayId]).
  // That left this page showing the base locale (Romanian) on first
  // client-side nav, only correcting itself on a hard refresh (which does
  // re-run the whole layout tree). Callers now pass next-intl's own
  // getLocale() explicitly (reliable per-request, set by next-intl's own
  // middleware on every request) instead of relying on that cache.
  const localeHeaders = getMedusaLocaleHeaders(locale)
  const headers = {
    ...(await getAuthHeaders()),
    ...localeHeaders,
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  const order = await sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        // The order item's own thumbnail is just the product's generic
        // image and ignores which variant (e.g. color) was ordered — the
        // detail page resolves the real image via getCartItemImageUrl,
        // which needs this same deep variant/product tree the cart fetches
        // (see retrieveCart in ./cart.ts).
        fields:
          "*payment_collections.payments,*items,+items.compare_at_unit_price,*items.metadata,*items.variant,+items.variant.thumbnail,*items.variant.images,*items.variant.product,+items.variant.product.thumbnail,*items.variant.product.images,+items.variant.product.options,+items.variant.product.options.values,*items.variant.product.variants,*items.variant.product.variants.options,*items.product,*fulfillments,*fulfillments.labels",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))

  await applyProductTranslationOverlay(order?.items, headers, localeHeaders)
  return order
}

// Order detail URLs use the human-friendly display_id (/profil/comenzi/148)
// instead of the internal order_… id. The store API can't fetch by
// display_id directly, so we scan the customer's own orders for it (cheap:
// almost no customer exceeds one page), then load the full order by id.
export const retrieveOrderByDisplayId = async (
  displayId: string,
  locale?: string
) => {
  const wanted = Number(displayId)

  if (!Number.isInteger(wanted) || wanted <= 0) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
    ...getMedusaLocaleHeaders(locale),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  const pageSize = 100
  for (let offset = 0; ; offset += pageSize) {
    const { orders, count } = await sdk.client
      .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
        method: "GET",
        query: {
          limit: pageSize,
          offset,
          order: "-created_at",
          fields: "id,display_id",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .catch((err) => medusaError(err))

    const match = orders.find((o) => o.display_id === wanted)
    if (match) {
      return retrieveOrder(match.id, locale)
    }

    if (offset + pageSize >= count) {
      return null
    }
  }
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
    ...getMedusaLocaleHeaders(),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "+total,+summary,*items,+items.metadata,*items.variant,*items.product,*fulfillments,*fulfillments.labels",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

export const createTransferRequest = async (
  state: {
    success: boolean
    error: string | null
    order: HttpTypes.StoreOrder | null
  },
  formData: FormData
): Promise<{
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}> => {
  const id = formData.get("order_id") as string

  if (!id) {
    const t = await getTranslations("account")
    return { success: false, error: t("ID-ul comenzii este obligatoriu"), order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}
