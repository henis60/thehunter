"use client"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"
import { useTranslations } from "next-intl"
import { isDropshipProduct } from "@lib/util/dropshipping"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const hasProductInfo = (product: HttpTypes.StoreProduct) =>
  !!product.origin_country ||
  !!product.weight ||
  !!(product.length && product.width && product.height)

const ProductTabs = ({ product }: ProductTabsProps) => {
  const t = useTranslations("products")
  const tabs = [
    ...(product.description ? [{
      label: t("Descriere"),
      component: <ProductDescriptionTab product={product} />,
    }] : []),
    ...(hasProductInfo(product) ? [{
      label: t("Detalii produs"),
      component: <ProductInfoTab product={product} />,
    }] : []),
    {
      label: t("Livrare & Retururi"),
      component: <ShippingInfoTab dropship={isDropshipProduct(product)} />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductDescriptionTab = ({ product }: ProductTabsProps) => {
  return (
    <div className="py-4">
      <p className="font-serif text-base leading-relaxed text-[var(--theme-text-muted)] whitespace-pre-line">
        {product.description}
      </p>
    </div>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  const t = useTranslations("products")
  const rows = [
    { label: t("Țară de origine"), value: product.origin_country },
    {
      label: t("Greutate"),
      value: product.weight ? t("{weight} g", { weight: product.weight }) : null,
    },
    {
      label: t("Dimensiuni"),
      value:
        product.length && product.width && product.height
          ? t("{length}L x {width}W x {height}H", {
              length: product.length,
              width: product.width,
              height: product.height,
            })
          : null,
    },
  ].filter((r) => !!r.value)

  if (rows.length === 0) return null

  return (
    <div className="py-4 flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4">
          <span className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">{row.label}</span>
          <span className="font-sans text-[11px] text-[var(--theme-text)]">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

const ShippingInfoTab = ({ dropship }: { dropship: boolean }) => {
  const t = useTranslations("products")
  const items = [
    dropship
      ? {
          label: t("Livrare gratuită"),
          desc: t("Livrare gratuită, în 7–10 zile"),
        }
      : { label: t("Livrare rapidă"), desc: t("Coletul ajunge în 3–5 zile lucrătoare la adresa ta sau la un punct de ridicare") },
    { label: t("Schimburi simple"), desc: t("Nu se potrivește? Schimbăm produsul fără bătăi de cap") },
    { label: t("Retururi ușoare"), desc: t("Ai 14 zile să returnezi produsul și îți rambursăm banii") },
  ]

  return (
    <div className="py-4 flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.label}>
          <p className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-1">{item.label}</p>
          <p className="font-sans text-[12px] leading-relaxed text-[var(--theme-text-muted)]">{item.desc}</p>
        </div>
      ))}
    </div>
  )
}

export default ProductTabs
