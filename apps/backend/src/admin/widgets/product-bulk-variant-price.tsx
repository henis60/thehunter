import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types";
import {
  Button,
  Container,
  Input,
  Select,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { Spinner } from "@medusajs/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { sdk } from "../lib/client";

// Small sidebar widget: set one price, in one currency, for every variant of
// the product at once.
//
// Medusa's variant update replaces the variant's whole (non-price-list) price
// set with whatever `prices` array it receives — anything missing is deleted,
// and prices are de-duplicated by currency/quantity/rules, NOT by id. So for
// every variant we resend *all* its existing prices (id, currency, amount,
// quantities, rules) and only change the amount of the base price (no rules,
// no quantity tiers) in the chosen currency. Region prices, tiered prices,
// other currencies and price-list prices are left as they were.

type PriceRule = { attribute: string; value: string };
type VariantPrice = {
  id: string;
  currency_code: string;
  amount: number;
  min_quantity?: number | null;
  max_quantity?: number | null;
  price_list_id?: string | null;
  price_rules?: PriceRule[] | null;
};
type Variant = { id: string; title?: string | null; prices?: VariantPrice[] | null };

const BATCH_SIZE = 50;

const isBasePrice = (p: VariantPrice) =>
  !p.price_list_id &&
  !(p.price_rules && p.price_rules.length) &&
  p.min_quantity == null &&
  p.max_quantity == null;

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
};

const parseAmount = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const buildPricesPayload = (
  variant: Variant,
  currency: string,
  amount: number
) => {
  const own = (variant.prices ?? []).filter((p) => !p.price_list_id);
  let replaced = false;

  const prices = own.map((p) => {
    const rules = (p.price_rules ?? []).reduce<Record<string, string>>(
      (acc, r) => ({ ...acc, [r.attribute]: r.value }),
      {}
    );
    const target =
      !replaced && isBasePrice(p) && p.currency_code.toLowerCase() === currency;
    if (target) replaced = true;
    return {
      id: p.id,
      currency_code: p.currency_code,
      amount: target ? amount : p.amount,
      ...(p.min_quantity != null ? { min_quantity: p.min_quantity } : {}),
      ...(p.max_quantity != null ? { max_quantity: p.max_quantity } : {}),
      ...(Object.keys(rules).length ? { rules } : {}),
    };
  });

  if (!replaced) prices.push({ currency_code: currency, amount } as any);
  return prices;
};

const ProductBulkVariantPriceWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient();
  const prompt = usePrompt();
  const [currency, setCurrency] = useState<string>("");
  const [value, setValue] = useState("");

  const queryKey = ["bulk-variant-price", product.id];

  const { data: variants, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { product: p } = await sdk.admin.product.retrieve(product.id, {
        fields:
          "id,variants.id,variants.title,variants.prices.id,variants.prices.amount,variants.prices.currency_code,variants.prices.min_quantity,variants.prices.max_quantity,variants.prices.price_list_id,variants.prices.price_rules.attribute,variants.prices.price_rules.value",
      });
      return ((p as any).variants ?? []) as Variant[];
    },
  });

  const { data: storeCurrencies } = useQuery({
    queryKey: ["bulk-variant-price-store-currencies"],
    queryFn: async () => {
      const { stores } = await sdk.admin.store.list({
        fields: "id,supported_currencies.currency_code,supported_currencies.is_default",
      });
      return (stores?.[0]?.supported_currencies ?? []) as {
        currency_code: string;
        is_default?: boolean;
      }[];
    },
  });

  // Currencies: store-supported ones first (default first), plus anything the
  // variants already have a base price in.
  const currencies = useMemo(() => {
    const list: string[] = [];
    const add = (c?: string) => {
      const code = c?.toLowerCase();
      if (code && !list.includes(code)) list.push(code);
    };
    [...(storeCurrencies ?? [])]
      .sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default))
      .forEach((c) => add(c.currency_code));
    variants?.forEach((v) =>
      v.prices?.filter(isBasePrice).forEach((p) => add(p.currency_code))
    );
    if (!list.length) add("ron");
    return list;
  }, [storeCurrencies, variants]);

  useEffect(() => {
    if (!currency && currencies.length) {
      setCurrency(currencies.includes("ron") && !storeCurrencies?.some((c) => c.is_default)
        ? "ron"
        : currencies[0]);
    }
  }, [currencies, currency, storeCurrencies]);

  const summaries = useMemo(() => {
    return currencies.map((code) => {
      const amounts = (variants ?? [])
        .map(
          (v) =>
            v.prices?.find(
              (p) => isBasePrice(p) && p.currency_code.toLowerCase() === code
            )?.amount
        )
        .filter((a): a is number => typeof a === "number");
      const missing = (variants?.length ?? 0) - amounts.length;
      const min = amounts.length ? Math.min(...amounts) : null;
      const max = amounts.length ? Math.max(...amounts) : null;
      return { code, min, max, missing };
    });
  }, [currencies, variants]);

  const apply = useMutation({
    mutationFn: async ({ code, amount }: { code: string; amount: number }) => {
      const list = variants ?? [];
      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const chunk = list.slice(i, i + BATCH_SIZE);
        await sdk.admin.product.batchVariants(product.id, {
          update: chunk.map((v) => ({
            id: v.id,
            prices: buildPricesPayload(v, code, amount) as any,
          })),
        });
      }
      return list.length;
    },
    onSuccess: (count, { code, amount }) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["product", product.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product_variants"] });
      setValue("");
      toast.success(
        `Prețul a fost setat la ${formatAmount(amount, code)} pentru ${count} ${
          count === 1 ? "variantă" : "variante"
        }`
      );
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey });
      toast.error(
        error instanceof Error ? error.message : "Actualizarea prețurilor a eșuat"
      );
    },
  });

  const amount = parseAmount(value);
  const variantCount = variants?.length ?? 0;

  const onApply = async () => {
    if (amount === null || !currency || !variantCount) return;
    const confirmed = await prompt({
      title: "Aplici prețul la toate variantele?",
      description: `Toate cele ${variantCount} ${
        variantCount === 1 ? "variantă" : "variante"
      } vor avea prețul ${formatAmount(amount, currency)}. Prețurile în alte monede, pe regiuni și din listele de prețuri rămân neschimbate.`,
      confirmText: "Aplică",
      cancelText: "Anulează",
    });
    if (confirmed) apply.mutate({ code: currency, amount });
  };

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          Preț pentru toate variantele
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle mt-1">
          Setează același preț pentru toate variantele produsului.
        </Text>
      </div>

      {isLoading ? (
        <div className="flex justify-center px-6 py-4">
          <Spinner className="animate-spin" />
        </div>
      ) : !variantCount ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Produsul nu are variante.
          </Text>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 px-6 py-4">
            {summaries.map((s) => (
              <div key={s.code} className="flex items-center justify-between gap-3">
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  {s.code.toUpperCase()}
                </Text>
                <Text size="small" leading="compact" className="text-right">
                  {s.min === null
                    ? "—"
                    : s.min === s.max
                    ? formatAmount(s.min, s.code)
                    : `${formatAmount(s.min, s.code)} – ${formatAmount(s.max!, s.code)}`}
                  {s.missing > 0 && s.min !== null && (
                    <span className="text-ui-fg-muted">
                      {" "}
                      ({s.missing} fără preț)
                    </span>
                  )}
                </Text>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex gap-2">
              {currencies.length > 1 && (
                <div className="w-24 shrink-0">
                  <Select size="small" value={currency} onValueChange={setCurrency}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {currencies.map((c) => (
                        <Select.Item key={c} value={c}>
                          {c.toUpperCase()}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
              <Input
                size="small"
                inputMode="decimal"
                placeholder={
                  currencies.length > 1 ? "Preț nou" : `Preț nou (${currency.toUpperCase()})`
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onApply();
                }}
                aria-invalid={value.trim() !== "" && amount === null}
                disabled={apply.isPending}
              />
            </div>
            {value.trim() !== "" && amount === null && (
              <Text size="small" className="text-ui-fg-error">
                Introdu un preț valid (ex. 199 sau 199,90).
              </Text>
            )}
            <Button
              size="small"
              variant="secondary"
              className="w-full"
              disabled={amount === null || !currency || apply.isPending}
              isLoading={apply.isPending}
              onClick={onApply}
            >
              Aplică la toate variantele
            </Button>
          </div>
        </>
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
});

export default ProductBulkVariantPriceWidget;
