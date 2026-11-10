import { Text, clx } from "@modules/common/components/ui"
import { VariantPrice } from "types/global"

export default function PreviewPrice({ price }: { price: VariantPrice }) {
  if (!price) {
    return null
  }

  return (
    <div className="flex items-baseline gap-x-2">
      {price.price_type === "sale" && (
        <Text
          className="line-through text-[15px] text-[var(--theme-text-muted)]"
          data-testid="original-price"
        >
          {price.original_price}
        </Text>
      )}
      <Text
        className={clx("font-sans text-[15px] tracking-[1px]", {
          "text-hunter-gold-b": price.price_type === "sale",
          "text-hunter-gold": price.price_type !== "sale",
        })}
        data-testid="price"
      >
        {price.calculated_price}
      </Text>
    </div>
  )
}
