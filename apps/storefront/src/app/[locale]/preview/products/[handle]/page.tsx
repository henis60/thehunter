import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getRegion } from "@lib/data/regions"
import { backendBaseUrl } from "@lib/config"
import { getImagesForVariant } from "@lib/util/product"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"

type Props = {
  params: Promise<Record<string, string>>
  searchParams: Promise<{ token?: string; v_id?: string }>
}

async function fetchPreviewProduct(
  handle: string,
  token: string,
  regionId: string
): Promise<HttpTypes.StoreProduct | null> {
  const backendUrl = backendBaseUrl
  return fetch(
    `${backendUrl}/store/preview/products/${encodeURIComponent(handle)}?token=${encodeURIComponent(token)}&region_id=${regionId}`,
    {
      headers: {
        "x-publishable-api-key":
          process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  )
    .then((r) => r.json())
    .then((d) => d?.product ?? null)
    .catch(() => null)
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const searchParams = await props.searchParams

  if (!searchParams.token) {
    return { title: { absolute: "Preview | The Hunter House" } }
  }

  const region = await getRegion("ro")
  if (!region) {
    return { title: { absolute: "Preview | The Hunter House" } }
  }

  const product = await fetchPreviewProduct(
    params.handle,
    searchParams.token,
    region.id
  )

  const title = product?.title
    ? `${product.title} (Preview) | The Hunter House`
    : "Preview | The Hunter House"

  return {
    title: { absolute: title },
    description: product?.title ?? "Product preview",
    robots: { index: false, follow: false },
  }
}

export default async function ProductPreviewPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams

  const token = searchParams.token
  if (!token) {
    notFound()
  }

  const region = await getRegion("ro")
  if (!region) {
    notFound()
  }

  const rawProduct = await fetchPreviewProduct(params.handle, token, region.id)
  if (!rawProduct) {
    notFound()
  }

  const t = await getTranslations("app")

  // Map raw prices to calculated_price format expected by ProductActions
  const product: HttpTypes.StoreProduct = {
    ...rawProduct,
    variants: (rawProduct.variants ?? []).map((v: any) => {
      const price = v.prices?.find((p: any) => p.currency_code === region.currency_code)
        ?? v.prices?.[0]
      return {
        ...v,
        manage_inventory: false,
        calculated_price: price ? {
          calculated_amount: price.amount,
          original_amount: price.amount,
          currency_code: price.currency_code,
          calculated_price: { price_list_type: null },
        } : undefined,
      }
    }),
  }

  const images = getImagesForVariant(product, searchParams.v_id)

  return (
    <>
      <div
        style={{
          background: "#fef3c7",
          color: "#92400e",
          textAlign: "center",
          padding: "8px 16px",
          fontWeight: 600,
          fontSize: "15px",
          letterSpacing: "0.05em",
          position: "sticky",
          top: "64px",
          zIndex: 9000,
        }}
      >
        {t("PROPOSED - acest produs nu este publicat")}
      </div>
      <ProductTemplate
        product={product}
        region={region}
        countryCode={"ro"}
        images={images ?? []}
        previewFallback={true}
      />
    </>
  )
}

