import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Container, Heading, Text, Badge, toast } from "@medusajs/ui";
import { Eye, Photo, XMark } from "@medusajs/icons";
import { sdk } from "../../lib/client";
import MediaLibraryPicker from "../../components/media-library-picker";

// ── Types ──────────────────────────────────────────────────────────────────

type RowStatus =
  | "idle"
  | "uploading"
  | "generating"
  | "creating"
  | "done"
  | "error";

type Row = {
  index: number;
  sku_prefix: string;
  price_ron: string;
  colors: string;
  sizes: string;
  material: string;
  collection: string;
  category: string;
  tags: string;
  stock: string;
  technical_details: string;
  inStoreOnly: boolean;
  dropshipping: boolean;
  libraryUrls: string[];
  status: RowStatus;
  error?: string;
  warning?: string;
  productId?: string;
  productTitle?: string;
  productHandle?: string;
};

type AIResult = {
  title: string;
  subtitle?: string;
  description: string;
  handle: string;
  seo_title: string;
  seo_description: string;
  category: string | null;
  collection: string | null;
  tags: string[];
  material: string | null;
  colors: string[];
  colors_hex: string[];
  colors_en: string[];
  sizes: string[];
  image_order: number[];
  variant_images: Record<string, number[]>;
  translations?: {
    en: {
      title: string;
      subtitle?: string;
      description: string;
      seo_title: string;
      seo_description: string;
      material: string | null;
    };
  };
};

// ── CSV parser ─────────────────────────────────────────────────────────────

function parseCsv(text: string): Partial<Row>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  function splitRow(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  }

  const headers = splitRow(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );
  return lines.slice(1).map((line) => {
    const values = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[șşŞŠ]/g, "s")
    .replace(/[țţŢŤ]/g, "t")
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");
}

// ── Variant builders ────────────────────────────────────────────────────────

function buildVariants(
  colors: string[],
  sizes: string[],
  skuPrefix: string,
  priceRon: number | number[],
  colorsHex: string[] = [],
  disableInventory = false,
) {
  const priceFor = (idx: number) => {
    const amount = Array.isArray(priceRon)
      ? (priceRon[idx] ?? priceRon[0] ?? 0)
      : priceRon;
    return [{ currency_code: "ron", amount }];
  };
  const hexFor = (color: string) => {
    const idx = colors.indexOf(color);
    return colorsHex[idx] ?? null;
  };
  if (colors.length && sizes.length) {
    return colors.flatMap((color, ci) =>
      sizes.map((size) => {
        const hex = hexFor(color);
        return {
          title: `${color} / ${size}`,
          sku: `${skuPrefix}-${slugify(color)}-${slugify(size)}`,
          options: { Culoare: color, Mărime: size },
          ...(hex ? { material: hex, metadata: { color_hex: hex } } : {}),
          ...(disableInventory ? { manage_inventory: false } : {}),
          prices: priceFor(ci),
        };
      }),
    );
  }
  if (colors.length) {
    return colors.map((color, ci) => {
      const hex = hexFor(color);
      return {
        title: color,
        sku: `${skuPrefix}-${slugify(color)}`,
        options: { Culoare: color },
        ...(hex ? { material: hex, metadata: { color_hex: hex } } : {}),
        ...(disableInventory ? { manage_inventory: false } : {}),
        prices: priceFor(ci),
      };
    });
  }
  if (sizes.length) {
    return sizes.map((size, si) => ({
      title: size,
      sku: `${skuPrefix}-${slugify(size)}`,
      options: { Mărime: size },
      ...(disableInventory ? { manage_inventory: false } : {}),
      prices: priceFor(si),
    }));
  }
  return [
    {
      title: "Default",
      sku: skuPrefix,
      options: {},
      ...(disableInventory ? { manage_inventory: false } : {}),
      prices: priceFor(0),
    },
  ];
}

function buildOptions(colors: string[], sizes: string[]) {
  const opts = [];
  if (colors.length) opts.push({ title: "Culoare", values: colors });
  if (sizes.length) opts.push({ title: "Mărime", values: sizes });
  return opts;
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<
    RowStatus,
    { color: "grey" | "green" | "red" | "blue" | "orange"; label: string }
  > = {
    idle: { color: "grey", label: "Așteptare" },
    uploading: { color: "blue", label: "Upload..." },
    generating: { color: "blue", label: "Generez..." },
    creating: { color: "orange", label: "Creare..." },
    done: { color: "green", label: "✓ Creat" },
    error: { color: "red", label: "Eroare" },
  };
  const { color, label } = map[status];
  return (
    <Badge color={color} className="whitespace-nowrap w-fit">
      {label}
    </Badge>
  );
}

// ── Inline input ────────────────────────────────────────────────────────────

function Cell({
  value,
  onChange,
  placeholder,
  disabled,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-transparent border-b border-transparent hover:border-ui-border-base focus:border-ui-border-interactive focus:outline-none py-0.5 text-sm text-ui-fg-base placeholder:text-ui-fg-muted disabled:opacity-40 disabled:cursor-not-allowed ${mono ? "font-mono text-xs" : ""}`}
    />
  );
}

// ── Select cell ─────────────────────────────────────────────────────────────

function SelectCell({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = btnRef.current
        ?.closest("[data-select-cell]")
        ?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideButton && !insidePanel) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    setRect(btnRef.current?.getBoundingClientRect() ?? null);
    setOpen((o) => !o);
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div data-select-cell className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full flex items-center justify-between gap-1 bg-ui-bg-field border border-ui-border-base rounded-md pl-2 pr-2 py-1 text-sm focus:outline-none focus:border-ui-border-interactive focus:ring-1 focus:ring-ui-border-interactive disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span
          className={`truncate ${selected ? "text-ui-fg-base" : "text-ui-fg-muted"}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="flex-shrink-0 text-ui-fg-muted"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              minWidth: rect.width,
              zIndex: 9999,
            }}
            className="bg-ui-bg-base border border-ui-border-base rounded-md shadow-elevation-flyout overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-ui-fg-muted hover:bg-ui-bg-base-hover"
              >
                {placeholder}
              </button>
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-ui-bg-base-hover ${o.value === value ? "text-ui-fg-interactive font-medium" : "text-ui-fg-base"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── Check cell ──────────────────────────────────────────────────────────────

function CheckCell({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-4 h-4 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-ui-border-interactive focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center ${
        checked
          ? "bg-ui-fg-interactive border-ui-fg-interactive"
          : "bg-ui-bg-base border-ui-border-strong hover:border-ui-border-interactive"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
          <path
            d="M2 6l3 3 5-5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// ── Row images — chosen exclusively from the media library (uploading new
// files, when needed, happens inside that picker's own upload flow) ────────

function ImageCell({
  row,
  disabled,
  onLibraryUrls,
}: {
  row: Row;
  disabled: boolean;
  onLibraryUrls: (index: number, urls: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex flex-wrap gap-1">
        {row.libraryUrls.map((url, i) => (
          <div key={`u-${i}`} className="relative group">
            <img
              src={url}
              alt=""
              className="w-9 h-11 object-cover rounded border border-ui-border-base"
            />
            {!disabled && (
              <button
                className="absolute -top-1 -right-1 bg-ui-bg-base border border-ui-border-base rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-ui-fg-subtle hover:text-ui-fg-error"
                onClick={() =>
                  onLibraryUrls(
                    row.index,
                    row.libraryUrls.filter((_, j) => j !== i),
                  )
                }
              >
                <XMark className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            onClick={() => setPickerOpen(true)}
            title="Alege din bibliotecă"
            className={`w-9 h-11 border border-dashed rounded flex items-center justify-center transition-colors ${
              row.libraryUrls.length === 0
                ? "border-ui-border-interactive text-ui-fg-interactive hover:bg-ui-bg-subtle"
                : "border-ui-border-base text-ui-fg-subtle hover:border-ui-border-strong hover:bg-ui-bg-subtle"
            }`}
          >
            <Photo className="w-4 h-4" />
          </button>
        )}
      </div>
      {pickerOpen && (
        <MediaLibraryPicker
          onClose={() => setPickerOpen(false)}
          onSelect={(urls) => {
            onLibraryUrls(row.index, [...row.libraryUrls, ...urls]);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const AIProductPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [disableInventory, setDisableInventory] = useState(true);
  const csvRef = useRef<HTMLInputElement>(null);
  // Monotonic id source for new rows. Using `prev.length` (the old approach)
  // collides after a delete: e.g. rows indexed 0,1,2 → delete index 1 → length
  // is now 2 → a new row would also get index 2, duplicating an existing
  // row's id. Since every updater matches rows by `r.index === index`, both
  // rows then update together — edits to one (incl. select-cell choices)
  // appear to "not stick" because they're immediately echoed/overwritten by
  // the other row sharing the same id.
  const nextRowIndexRef = useRef(0);
  const nextRowIndex = () => nextRowIndexRef.current++;

  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => sdk.admin.productCategory.list({ limit: 100 }),
  });
  const { data: collectionsData } = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => sdk.admin.productCollection.list({ limit: 100 }),
  });
  const { data: productTypesData } = useQuery({
    queryKey: ["admin-product-types"],
    queryFn: () => sdk.admin.productType.list({ limit: 100 }),
  });
  const { data: tagsData } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: () => sdk.admin.productTag.list({ limit: 500 }),
  });
  const { data: stockLocationsData } = useQuery({
    queryKey: ["admin-stock-locations"],
    queryFn: () =>
      sdk.client.fetch<{ stock_locations: { id: string; name: string }[] }>(
        "/admin/stock-locations?limit=1",
      ),
  });
  const { data: salesChannelsData } = useQuery({
    queryKey: ["admin-sales-channels"],
    queryFn: () =>
      sdk.client.fetch<{ sales_channels: { id: string; name: string }[] }>(
        "/admin/sales-channels?limit=10",
      ),
  });

  const { data: shippingProfilesData } = useQuery({
    queryKey: ["admin-shipping-profiles"],
    queryFn: () =>
      sdk.client.fetch<{
        shipping_profiles: { id: string; name: string; type: string }[];
      }>("/admin/shipping-profiles?limit=20&fields=id,name,type"),
  });

  const categories = categoriesData?.product_categories ?? [];
  const collections = collectionsData?.collections ?? [];
  const tags: { id: string; value: string }[] = tagsData?.product_tags ?? [];
  const inStoreTypeId =
    (productTypesData?.product_types ?? []).find(
      (t: any) => t.value?.toLowerCase() === "in-store-only",
    )?.id ?? null;
  const firstLocationId = stockLocationsData?.stock_locations?.[0]?.id ?? null;
  const onlineChannelId =
    (salesChannelsData?.sales_channels ?? []).find(
      (sc: any) => sc.name?.toLowerCase() === "online",
    )?.id ?? null;
  const defaultShippingProfileId =
    (shippingProfilesData?.shipping_profiles ?? []).find((sp: any) =>
      sp.name?.toLowerCase().includes("default"),
    )?.id ?? null;
  // Creat de src/scripts/setup-dropshipping.ts (type „dropshipping”).
  const dropshipShippingProfileId =
    (shippingProfilesData?.shipping_profiles ?? []).find(
      (sp: any) => sp.type === "dropshipping",
    )?.id ?? null;

  // ── CSV ──────────────────────────────────────────────────────────────────

  const handleCsv = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error("CSV gol sau invalid");
        return;
      }
      if (!Object.keys(parsed[0]).includes("sku_prefix")) {
        toast.error("CSV trebuie să aibă coloana sku_prefix");
        return;
      }
      setRows((prev) => {
        const existingBySkу = new Map(prev.map((r) => [r.sku_prefix, r]));
        return parsed.map((raw) => {
          const sku = raw.sku_prefix ?? "";
          const existing = existingBySkу.get(sku);
          return (
            existing ?? {
              index: nextRowIndex(),
              sku_prefix: sku,
              price_ron: raw.price_ron ?? "",
              colors: raw.colors ?? "",
              sizes: raw.sizes ?? "",
              material: raw.material ?? "",
              collection: raw.collection ?? "",
              category: raw.category ?? "",
              tags: raw.tags ?? "",
              stock: raw.stock ?? "",
              technical_details: raw.technical_details ?? "",
              inStoreOnly: false,
              dropshipping: /^(1|true|da|yes|x)$/i.test(
                String(raw.dropshipping ?? "").trim(),
              ),
              libraryUrls: [],
              status: "idle" as RowStatus,
            }
          );
        });
      });
    };
    reader.readAsText(file);
  }, []);

  // ── Row updaters ─────────────────────────────────────────────────────────

  const updateField = (index: number, field: keyof Row, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.index === index ? { ...r, [field]: value } : r)),
    );
  };

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.index === index ? { ...r, ...patch } : r)),
    );
  };

  const deleteRow = (index: number) => {
    setRows((prev) => prev.filter((r) => r.index !== index));
  };

  const addEmptyRow = () => {
    setRows((prev) => [
      ...prev,
      {
        index: nextRowIndex(),
        sku_prefix: "",
        price_ron: "",
        colors: "",
        sizes: "",
        material: "",
        collection: "",
        category: "",
        tags: "",
        stock: "",
        technical_details: "",
        inStoreOnly: false,
        dropshipping: false,
        libraryUrls: [],
        status: "idle",
      },
    ]);
  };

  // ── Processing ───────────────────────────────────────────────────────────

  const canProcess =
    rows.length > 0 &&
    rows.every((r) => r.libraryUrls.length > 0 || r.status === "done");
  const pendingRows = rows.filter((r) => r.status !== "done");
  // Liniile încă modificabile — bifa „Dropshipping” din antet le comută pe toate.
  const editableRows = pendingRows;

  const processAll = async () => {
    setProcessing(true);

    const CONCURRENCY = 5;
    const hasImages = (r: Row) => r.libraryUrls.length > 0;
    const missingDropshipProfile = (r: Row) =>
      r.dropshipping && !dropshipShippingProfileId;
    const toProcess = rows.filter(
      (r) =>
        r.status !== "done" &&
        r.sku_prefix &&
        hasImages(r) &&
        !missingDropshipProfile(r),
    );
    const errored = rows.filter(
      (r) =>
        r.status !== "done" &&
        (!r.sku_prefix || !hasImages(r) || missingDropshipProfile(r)),
    );
    errored.forEach((row) => {
      if (!row.sku_prefix)
        updateRow(row.index, { status: "error", error: "SKU prefix lipsă" });
      else if (!hasImages(row))
        updateRow(row.index, { status: "error", error: "Lipsă imagini" });
      else
        updateRow(row.index, {
          status: "error",
          error:
            "Profilul de livrare „Dropshipping” nu există — rulează scriptul setup-dropshipping",
        });
    });

    let doneCount = 0;
    const processRow = async (row: Row) => {
      if (row.status === "done") return;

      let imageUrls: string[] = row.libraryUrls;

      // Generate with AI
      updateRow(row.index, { status: "generating" });
      let aiResult: AIResult;
      try {
        const resp = await sdk.client.fetch<{ result: AIResult }>(
          "/admin/ai/generate-product",
          {
            method: "POST",
            body: {
              imageUrl: imageUrls[0],
              imageUrls,
              ...(row.material ? { material: row.material } : {}),
              ...(row.colors
                ? {
                    colors: row.colors
                      .split(";")
                      .map((c) => c.trim())
                      .filter(Boolean),
                  }
                : {}),
              ...(row.sizes
                ? {
                    sizes: row.sizes
                      .split(";")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }
                : {}),
              ...(() => {
                if (!row.price_ron) return {};
                const p = parseFloat(
                  row.price_ron.split(";")[0].replace(",", "."),
                );
                return Number.isFinite(p) ? { price_ron: p } : {};
              })(),
              ...(row.technical_details?.trim()
                ? { technical_details: row.technical_details.trim() }
                : {}),
              ...(extraInstructions.trim()
                ? { extraInstructions: extraInstructions.trim() }
                : {}),
            },
          },
        );
        aiResult = resp.result;
      } catch (err: any) {
        updateRow(row.index, {
          status: "error",
          error: err.message || "AI error",
        });
        return;
      }

      // Reorder images as suggested by AI (front first, then back, then details)
      let imageOrderApplied = false;
      if (
        aiResult.image_order?.length === imageUrls.length &&
        imageUrls.length > 1
      ) {
        imageUrls = aiResult.image_order.map((i) => imageUrls[i]);
        imageOrderApplied = true;
      }

      // Create product
      updateRow(row.index, { status: "creating" });
      try {
        const colors = row.colors
          ? row.colors
              .split(";")
              .map((c) => c.trim())
              .filter(Boolean)
          : (aiResult.colors ?? []);
        const sizes = row.sizes
          ? row.sizes
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
          : (aiResult.sizes ?? []);

        // Reorder colors to match the order they appear in variant_images
        // (based on reordered image indices). colors_hex/colors_en are
        // parallel arrays the AI returns in its OWN original order and never
        // reorders itself — they're permuted alongside `colors` here so
        // hexFor()/translation lookups (which index into them by position)
        // stay aligned instead of pointing at the wrong color.
        if (colors.length > 1 && imageOrderApplied && aiResult.variant_images) {
          const norm = (s: string) => s.trim().toLowerCase();
          // variant_images keys come from the AI and can drift in casing/
          // whitespace from `colors` — resolve back to the exact string in
          // `colors` so `seen`/indexOf below match reliably.
          const byNorm = new Map(colors.map((c) => [norm(c), c]));
          const colorOrder: string[] = [];
          const seen = new Set<string>();
          // Iterate through reordered images and collect colors in order
          for (const origIdx of aiResult.image_order) {
            for (const [color, origIdxs] of Object.entries(
              aiResult.variant_images,
            )) {
              const match = byNorm.get(norm(color));
              if (
                match &&
                (origIdxs as number[]).includes(origIdx) &&
                !seen.has(match)
              ) {
                colorOrder.push(match);
                seen.add(match);
              }
            }
          }
          // Keep any colors not in variant_images at the end
          for (const c of colors) {
            if (!seen.has(c)) {
              colorOrder.push(c);
            }
          }
          if (colorOrder.length === colors.length) {
            const permutation = colorOrder.map((c) => colors.indexOf(c));
            colors.length = 0;
            colors.push(...colorOrder);
            if (aiResult.colors_hex?.length === permutation.length) {
              aiResult.colors_hex = permutation.map(
                (idx) => aiResult.colors_hex[idx],
              );
            }
            if (aiResult.colors_en?.length === permutation.length) {
              aiResult.colors_en = permutation.map(
                (idx) => aiResult.colors_en[idx],
              );
            }
          }
        }
        const priceRonRaw = row.price_ron.trim();
        const priceRon: number | number[] = priceRonRaw.includes(";")
          ? priceRonRaw
              .split(";")
              .map((p) => parseFloat(p.replace(",", ".")) || 0)
          : parseFloat(priceRonRaw.replace(",", ".")) ||
            aiResult.price_ron ||
            0;

        const categoryName = row.category || aiResult.category || null;
        const categoryId = categoryName
          ? categories.find(
              (c) =>
                c.name?.toLowerCase() === categoryName.toLowerCase() ||
                c.handle?.toLowerCase() === categoryName.toLowerCase(),
            )?.id
          : undefined;

        const collectionName =
          row.collection || aiResult.collection || undefined;
        const collectionId = collectionName
          ? collections.find(
              (c) =>
                c.title?.toLowerCase() === collectionName.toLowerCase() ||
                c.handle?.toLowerCase() === collectionName.toLowerCase(),
            )?.id
          : undefined;

        const material = row.material || aiResult.material || undefined;

        const buildPayload = (suffix?: string) => ({
          title: aiResult.title,
          subtitle: aiResult.subtitle,
          description: aiResult.description,
          handle: suffix ? `${aiResult.handle}-${suffix}` : aiResult.handle,
          status: "proposed",
          ...(material ? { material } : {}),
          thumbnail: imageUrls[0],
          images: imageUrls.map((url) => ({ url })),
          metadata: {
            seo_title: aiResult.seo_title,
            seo_description: aiResult.seo_description,
          },
          ...(row.inStoreOnly && inStoreTypeId
            ? { type_id: inStoreTypeId }
            : {}),
          ...(onlineChannelId
            ? { sales_channels: [{ id: onlineChannelId }] }
            : {}),
          ...(row.dropshipping && dropshipShippingProfileId
            ? { shipping_profile_id: dropshipShippingProfileId }
            : defaultShippingProfileId
              ? { shipping_profile_id: defaultShippingProfileId }
              : {}),
          options: buildOptions(colors, sizes),
          variants: buildVariants(
            colors,
            sizes,
            suffix ? `${row.sku_prefix}-${suffix}` : row.sku_prefix,
            priceRon,
            aiResult.colors_hex ?? [],
            disableInventory,
          ),
          ...(categoryId ? { categories: [{ id: categoryId }] } : {}),
          ...(collectionId ? { collection_id: collectionId } : {}),
          ...(() => {
            const rowTags = row.tags
              ? row.tags
                  .split(";")
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [];
            const finalTags = rowTags.length ? rowTags : (aiResult.tags ?? []);
            const tagIds = finalTags
              .map(
                (v) =>
                  tags.find((t) => t.value.toLowerCase() === v.toLowerCase())
                    ?.id,
              )
              .filter(Boolean) as string[];
            return tagIds.length ? { tags: tagIds.map((id) => ({ id })) } : {};
          })(),
        });

        let product: any;
        let attempt = 0;
        while (true) {
          try {
            const suffix = attempt > 0 ? String(attempt + 1) : undefined;
            const resp = await sdk.client.fetch<{ product: any }>(
              "/admin/products",
              {
                method: "POST",
                body: buildPayload(suffix),
              },
            );
            product = resp.product;
            break;
          } catch (err: any) {
            const msg: string = err.message || "";
            if (
              attempt < 5 &&
              (msg.includes("SKU") ||
                msg.includes("sku") ||
                msg.includes("unique") ||
                msg.includes("duplicate") ||
                msg.includes("handle"))
            ) {
              attempt++;
              continue;
            }
            throw err;
          }
        }

        // Save English translation (best-effort — must not abort creation).
        // Uses Medusa's native translation module: rows are keyed by
        // (reference, reference_id, locale_code) and `translations` only holds
        // fields Medusa marks .translatable() on Product — seo_* live in
        // metadata and aren't translatable, so they're intentionally omitted.
        if (aiResult.translations?.en) {
          try {
            const en = aiResult.translations.en;
            const enFields: Record<string, string> = {
              title: en.title,
              description: en.description,
            };
            if (en.subtitle) enFields.subtitle = en.subtitle;
            if (en.material) enFields.material = en.material;

            await sdk.client.fetch("/admin/translations/batch", {
              method: "POST",
              body: {
                create: [
                  {
                    reference: "product",
                    reference_id: product.id,
                    locale_code: "en-GB",
                    translations: enFields,
                  },
                ],
              },
            });
          } catch (err: any) {
            console.warn(
              "[AI] English translation save failed:",
              err?.message || err,
            );
            toast.warning("Traducerea EN nu a putut fi salvată");
          }
        }

        // Save English translations for the "Culoare" option values (e.g.
        // "Negru" → "Black"). product_option_value.value is natively
        // .translatable() in Medusa's product module — just not wired up
        // for color option values until now. Matched by exact RO value
        // (case-insensitive) since option values already exist on the
        // product from creation (see buildOptions above).
        if (colors.length && aiResult.colors_en?.length) {
          try {
            const colorOption = (product.options ?? []).find(
              (o: any) => o.title?.toLowerCase() === "culoare",
            );
            const optionValueTranslations = (colorOption?.values ?? [])
              .map((ov: any) => {
                const idx = colors.findIndex(
                  (c) => c.toLowerCase() === ov.value?.toLowerCase(),
                );
                if (idx === -1) return null;
                const en = aiResult.colors_en[idx];
                if (!en || en.toLowerCase() === ov.value.toLowerCase())
                  return null;
                return {
                  reference: "product_option_value",
                  reference_id: ov.id,
                  locale_code: "en-GB",
                  translations: { value: en },
                };
              })
              .filter(Boolean);

            if (optionValueTranslations.length) {
              await sdk.client.fetch("/admin/translations/batch", {
                method: "POST",
                body: { create: optionValueTranslations },
              });
            }
          } catch (err: any) {
            console.warn(
              "[AI] Color translation save failed:",
              err?.message || err,
            );
            toast.warning("Traducerea culorilor nu a putut fi salvată");
          }
        }

        // Save English translations for variant titles (e.g. "Negru / M" →
        // "Black / M"). ProductVariant.title is natively .translatable() too,
        // but it's a separate stored string built at creation (buildVariants
        // above), not re-derived from the option value at render time — so
        // translating the option value alone (previous block) doesn't cover
        // it. Cart/order line items display variant.title directly, so this
        // is what actually fixes the translation there.
        if (colors.length && aiResult.colors_en?.length) {
          try {
            const enByColor = new Map(
              colors.map((c, i) => [c.toLowerCase(), aiResult.colors_en[i]]),
            );
            const variantTranslations = (product.variants ?? [])
              .map((variant: any) => {
                const translatedTitle = (variant.title ?? "")
                  .split(" / ")
                  .map((seg: string) => enByColor.get(seg.toLowerCase()) ?? seg)
                  .join(" / ");
                if (
                  !translatedTitle ||
                  translatedTitle.toLowerCase() ===
                    (variant.title ?? "").toLowerCase()
                )
                  return null;
                return {
                  reference: "product_variant",
                  reference_id: variant.id,
                  locale_code: "en-GB",
                  translations: { title: translatedTitle },
                };
              })
              .filter(Boolean);

            if (variantTranslations.length) {
              await sdk.client.fetch("/admin/translations/batch", {
                method: "POST",
                body: { create: variantTranslations },
              });
            }
          } catch (err: any) {
            console.warn(
              "[AI] Variant title translation save failed:",
              err?.message || err,
            );
            toast.warning("Traducerea variantelor nu a putut fi salvată");
          }
        }

        // Resolve a variant's color by exact title segment ("Color / Size"),
        // not substring — avoids "Negru" matching "Negru închis".
        const colorOfVariant = (variant: any): string | undefined => {
          const segs = (variant.title ?? "")
            .split("/")
            .map((s: string) => s.trim().toLowerCase());
          return colors.find((c) => segs.includes(c.toLowerCase()));
        };

        // Associate images with variants using correct Medusa v2 API
        let variantImageWarning: string | undefined;
        if (product.variants?.length && imageUrls.length > 0) {
          try {
            // Fetch fresh product to get image IDs (creation response may omit them)
            const freshResp = await sdk.client.fetch<{ product: any }>(
              `/admin/products/${product.id}`,
            );
            const productImages: { id: string; url: string }[] =
              freshResp.product?.images ?? [];

            if (!productImages.length) {
              variantImageWarning = "Imagini produse lipsă după creare";
            } else {
              const indexToImageId = (idx: number): string | undefined =>
                productImages[idx]?.id ??
                productImages.find((img) => img.url === imageUrls[idx])?.id;
              const allImageIds = productImages
                .map((img) => img.id)
                .filter(Boolean) as string[];

              // Mapping color → image indices comes from the AI response.
              // Indices are ORIGINAL; translate to reordered positions.
              // Keys normalized to lowercase for tolerant lookup.
              const origToPos = (oi: number): number =>
                imageOrderApplied ? aiResult.image_order.indexOf(oi) : oi;
              const normMap = new Map<string, string[]>();
              for (const [color, idxs] of Object.entries(
                aiResult.variant_images ?? {},
              )) {
                const ids = (idxs as number[])
                  .map(origToPos)
                  .filter((p) => p >= 0)
                  .map(indexToImageId)
                  .filter(Boolean) as string[];
                if (ids.length) normMap.set(color.trim().toLowerCase(), ids);
              }

              const perColor =
                imageUrls.length > 1 && colors.length > 1 && normMap.size > 0;

              for (const variant of product.variants) {
                let imageIds = allImageIds;
                if (perColor) {
                  const color = colorOfVariant(variant);
                  const mapped = color
                    ? normMap.get(color.toLowerCase())
                    : undefined;
                  // Variant with no mapped images falls back to all images.
                  imageIds = mapped?.length ? mapped : allImageIds;
                }
                if (imageIds.length) {
                  await sdk.client.fetch(
                    `/admin/products/${product.id}/variants/${variant.id}/images/batch`,
                    { method: "POST", body: { add: imageIds, remove: [] } },
                  );
                }
              }
            }
          } catch (e: any) {
            console.error("[variant-images] FAILED:", e);
            variantImageWarning = `Imagini variante: ${e.message ?? "eroare"}`;
          }
        }

        // Set stock quantity — supports single value (10) or per-color (5;10;3)
        const stockValues = row.stock
          ? row.stock
              .split(";")
              .map((s) => parseInt(s.trim()))
              .filter((n) => !isNaN(n))
          : [];
        const stockForVariant = (variant: any): number => {
          if (stockValues.length === 0) return 0;
          if (stockValues.length === 1) return stockValues[0];
          // Match by color (exact segment, not substring)
          if (colors.length > 1) {
            const color = colorOfVariant(variant);
            const idx = color ? colors.indexOf(color) : -1;
            if (idx >= 0) return stockValues[idx] ?? stockValues[0];
          }
          // Fallback: positional
          const pos = product.variants.indexOf(variant);
          return stockValues[pos] ?? stockValues[0];
        };
        if (
          firstLocationId &&
          product.variants?.length &&
          stockValues.length > 0
        ) {
          try {
            // One fetch for all variants' inventory items (not one per variant)
            const { variants: freshVariants } = await sdk.client.fetch<{
              variants: any[];
            }>(
              `/admin/products/${product.id}/variants?fields=id,title,inventory_items.inventory_item_id&limit=100`,
            );
            const invItemOf = (variantId: string): string | undefined =>
              freshVariants.find((v) => v.id === variantId)
                ?.inventory_items?.[0]?.inventory_item_id;
            for (const variant of product.variants) {
              const invItemId = invItemOf(variant.id);
              if (invItemId) {
                await sdk.client.fetch(
                  `/admin/inventory-items/${invItemId}/location-levels`,
                  {
                    method: "POST",
                    body: {
                      location_id: firstLocationId,
                      stocked_quantity: stockForVariant(variant),
                    },
                  },
                );
              }
            }
          } catch (e: any) {
            console.error("[stock] Failed:", e);
            variantImageWarning =
              (variantImageWarning ? variantImageWarning + "; " : "") +
              `Stoc nesalvat: ${e.message ?? "eroare"}`;
          }
        }

        doneCount++;
        updateRow(row.index, {
          status: "done",
          productId: product.id,
          productTitle: product.title,
          productHandle: product.handle,
          ...(variantImageWarning
            ? { warning: variantImageWarning }
            : attempt > 0
              ? { warning: `SKU duplicat — creat cu sufixul -${attempt + 1}` }
              : {}),
        });
      } catch (err: any) {
        updateRow(row.index, {
          status: "error",
          error: err.message || "Create error",
        });
      }
    };

    // Process in parallel batches of CONCURRENCY
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      await Promise.all(toProcess.slice(i, i + CONCURRENCY).map(processRow));
    }

    setProcessing(false);
    if (doneCount > 0) toast.success(`${doneCount} produse create cu succes`);
  };

  // ── Report ───────────────────────────────────────────────────────────────

  const downloadReport = () => {
    const csv = [
      "index,sku_prefix,title,status,product_id,error",
      ...rows.map((r) =>
        [
          r.index + 1,
          r.sku_prefix,
          r.productTitle ?? "",
          r.status,
          r.productId ?? "",
          r.error ?? "",
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-product-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = rows.filter((r) => r.status === "done").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-y-4 p-6 max-w-[1600px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">AI Product Generator</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-0.5">
            Import CSV sau adaugă manual — AI completează titlul, descrierea și
            variantele din imagine.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCsv(f);
              e.target.value = "";
            }}
          />
          <Button
            size="small"
            variant="secondary"
            onClick={() => csvRef.current?.click()}
          >
            Import CSV
          </Button>
          {doneCount > 0 && (
            <Button size="small" variant="secondary" onClick={downloadReport}>
              Descarcă raport
            </Button>
          )}
          {rows.length > 0 && (
            <Button
              size="small"
              onClick={processAll}
              isLoading={processing}
              disabled={processing || !canProcess || pendingRows.length === 0}
            >
              {processing
                ? "Procesez..."
                : `Generează ${pendingRows.length} produse`}
            </Button>
          )}
        </div>
      </div>

      {/* ── How it works ── */}
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-1.5 text-sm text-ui-fg-subtle hover:text-ui-fg-base select-none w-fit">
          <span className="transition-transform group-open:rotate-90 inline-block text-xs">
            ▶
          </span>
          Cum funcționează?
        </summary>
        <Container className="mt-2 px-5 py-4">
          <div className="grid grid-cols-1 small:grid-cols-5 gap-4">
            {[
              {
                n: "1",
                title: "Introduci datele",
                body: "Importezi un CSV sau adaugi rânduri manual. Completezi fotografiile, prețul, SKU-ul și opțional culorile/mărimile/colecția.",
              },
              {
                n: "2",
                title: "Instrucțiuni opționale",
                body: 'Poți adăuga indicații pentru AI aplicate tuturor produselor — ex: "Accentuează căldura materialelor, colecție toamnă-iarnă 2025."',
              },
              {
                n: "3",
                title: "AI analizează fotografiile",
                body: "Claude generează titlu, descriere elegantă, culori cu cod hex, mărimi, material, categorie, colecție sugerată, taguri și câmpuri SEO — plus ordinea optimă a pozelor.",
              },
              {
                n: "4",
                title: "Produsul e creat automat",
                body: "Cu toate variantele (Negru/S, Negru/M, Maro/L...), prețurile, imaginile asociate fiecărei culori și stocul inițial.",
              },
              {
                n: "5",
                title: "Verifici și publici",
                body: "Produsul e creat ca draft — nu apare în magazin. Din tabel poți face Preview ca să-l vezi înainte, apoi Publică pentru a-l face vizibil.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-ui-bg-interactive flex items-center justify-center">
                  <Text
                    size="xsmall"
                    weight="plus"
                    className="text-white leading-none"
                  >
                    {n}
                  </Text>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Text size="small" weight="plus" className="text-ui-fg-base">
                    {title}
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {body}
                  </Text>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-ui-border-base">
            <Text size="small" className="text-ui-fg-muted">
              Câteva fotografii și un prefix de SKU sunt tot ce ai nevoie. În
              30–60 de secunde, produsul apare în admin — cu descriere,
              variante, prețuri și stoc, gata de publicat.
            </Text>
          </div>
        </Container>
      </details>

      {/* ── AI instructions ── */}
      <Container className="px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Text size="small" weight="plus" className="text-ui-fg-base">
              Instrucțiuni extra pentru AI
            </Text>
            <Text size="small" className="text-ui-fg-muted">
              opțional — aplicate la toate produsele din sesiune
            </Text>
          </div>
          <textarea
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            placeholder={`Ex: Produsele sunt pentru sezonul toamnă-iarnă 2025. Accentuează căldura și robustețea materialelor.`}
            disabled={processing}
            rows={2}
            className="w-full rounded-lg border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:border-ui-border-interactive focus:outline-none resize-none disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-2">
          <CheckCell
            checked={disableInventory}
            onChange={setDisableInventory}
            disabled={processing}
          />
          <Text size="small" className="text-ui-fg-base">
            Dezactivează Manage Inventory
          </Text>
          <Text size="small" className="text-ui-fg-muted">
            — produsele vor fi create fără verificare de stoc
          </Text>
        </div>
      </Container>

      {/* Table */}
      <Container className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border-base bg-ui-bg-subtle">
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs w-8">
                  #
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Imagini <span className="text-ui-fg-error">*</span>
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  SKU prefix <span className="text-ui-fg-error">*</span>
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Preț RON
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Culori
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Mărimi
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Material
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Detalii Tehnice
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Colecție
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Categorie
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Taguri
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Stoc
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs whitespace-nowrap">
                  Doar magazin
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs whitespace-nowrap">
                  <div
                    className="flex items-center gap-1.5"
                    title="Livrare gratuită, fără AWB, în 7–10 zile. Bifa din antet se aplică tuturor liniilor."
                  >
                    <CheckCell
                      checked={
                        editableRows.length > 0 &&
                        editableRows.every((r) => r.dropshipping)
                      }
                      onChange={(v) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.status === "done" ? r : { ...r, dropshipping: v },
                          ),
                        )
                      }
                      disabled={processing || editableRows.length === 0}
                    />
                    Dropshipping
                  </div>
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Status
                </th>
                <th className="text-left py-2 px-3 text-ui-fg-subtle font-medium text-xs">
                  Produs
                </th>
                <th className="w-6 px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isDone = row.status === "done";
                const isBusy = ["uploading", "generating", "creating"].includes(
                  row.status,
                );
                const disabled = isDone || isBusy || processing;

                return (
                  <tr
                    key={row.index}
                    className="border-b border-ui-border-base hover:bg-ui-bg-subtle"
                  >
                    <td className="py-2 px-3 text-ui-fg-muted text-xs">
                      {row.index + 1}
                    </td>
                    <td className="py-2 px-3">
                      <ImageCell
                        row={row}
                        onLibraryUrls={(i, u) =>
                          updateField(i, "libraryUrls", u)
                        }
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.sku_prefix}
                        onChange={(v) =>
                          updateField(row.index, "sku_prefix", v)
                        }
                        placeholder="EST-JKT"
                        disabled={disabled}
                        mono
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.price_ron}
                        onChange={(v) => updateField(row.index, "price_ron", v)}
                        placeholder="1750"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.colors}
                        onChange={(v) => updateField(row.index, "colors", v)}
                        placeholder="Negru;Maro"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.sizes}
                        onChange={(v) => updateField(row.index, "sizes", v)}
                        placeholder="S;M;L"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.material}
                        onChange={(v) => updateField(row.index, "material", v)}
                        placeholder="Tweed"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <textarea
                        value={row.technical_details}
                        onChange={(e) =>
                          updateField(row.index, "technical_details", e.target.value)
                        }
                        placeholder="Dimensiune: 25 × 25 cm&#10;Finisaj premium"
                        disabled={disabled}
                        rows={2}
                        className="w-full bg-transparent border-b border-transparent hover:border-ui-border-base focus:border-ui-border-interactive focus:outline-none py-0.5 text-sm text-ui-fg-base placeholder:text-ui-fg-muted disabled:opacity-40 disabled:cursor-not-allowed resize-none"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <SelectCell
                        value={row.collection}
                        onChange={(v) =>
                          updateField(row.index, "collection", v)
                        }
                        placeholder="— colecție —"
                        disabled={disabled}
                        options={collections.map((c) => ({
                          value: c.title ?? c.handle ?? c.id,
                          label: c.title ?? c.handle ?? c.id,
                        }))}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <SelectCell
                        value={row.category}
                        onChange={(v) => updateField(row.index, "category", v)}
                        placeholder="— categorie —"
                        disabled={disabled}
                        options={categories.map((c) => ({
                          value: c.name ?? c.handle ?? c.id,
                          label: c.name ?? c.handle ?? c.id,
                        }))}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.tags}
                        onChange={(v) => updateField(row.index, "tags", v)}
                        placeholder="elegant;formal"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Cell
                        value={row.stock}
                        onChange={(v) => updateField(row.index, "stock", v)}
                        placeholder="10"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <CheckCell
                        checked={row.inStoreOnly}
                        onChange={(v) =>
                          updateField(row.index, "inStoreOnly", v)
                        }
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <CheckCell
                        checked={row.dropshipping}
                        onChange={(v) =>
                          updateField(row.index, "dropshipping", v)
                        }
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-3 min-w-[130px]">
                      <div className="flex flex-col gap-1.5">
                        <StatusBadge status={row.status} />
                        {row.warning && (
                          <div className="flex items-start gap-1">
                            <span className="text-[10px] text-ui-fg-muted leading-tight">
                              ⚠ {row.warning}
                            </span>
                          </div>
                        )}
                        {row.error && (
                          <div className="rounded bg-ui-bg-error px-1.5 py-0.5">
                            <span className="text-[10px] text-ui-fg-error leading-tight">
                              {row.error}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 min-w-[180px]">
                      {row.productId ? (
                        <div className="flex flex-col gap-1.5">
                          <a
                            href={`/app/products/${row.productId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-ui-fg-base hover:text-ui-fg-interactive hover:underline leading-tight line-clamp-2"
                          >
                            {row.productTitle || row.productId}
                          </a>
                          <div className="flex items-center gap-2">
                            {row.productHandle && (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] text-ui-fg-subtle border border-ui-border-base rounded px-1.5 py-0.5 hover:bg-ui-bg-subtle hover:text-ui-fg-base transition-colors"
                                onClick={async () => {
                                  const { token } = await sdk.client.fetch<{
                                    token: string;
                                  }>(
                                    `/admin/ai/preview-token?product_id=${row.productId}`,
                                  );
                                  window.open(
                                    `${import.meta.env.VITE_STOREFRONT_URL || "http://localhost:8000"}/preview/products/${row.productHandle}?token=${token}`,
                                    "_blank",
                                  );
                                }}
                              >
                                <Eye className="w-3 h-3" /> Preview
                              </button>
                            )}
                            <button
                              className="inline-flex items-center gap-1 text-[11px] text-ui-fg-interactive border border-ui-border-interactive rounded px-1.5 py-0.5 hover:bg-ui-bg-interactive hover:text-white transition-colors"
                              onClick={async () => {
                                await sdk.client.fetch(
                                  `/admin/products/${row.productId}`,
                                  {
                                    method: "POST",
                                    body: { status: "published" },
                                  },
                                );
                                toast.success(`${row.productTitle} publicat`);
                              }}
                            >
                              Publică
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2">
                      {!isDone && (
                        <button
                          onClick={() => deleteRow(row.index)}
                          disabled={isBusy || processing}
                          title="Șterge rând"
                          className="w-5 h-5 flex items-center justify-center rounded text-ui-fg-muted hover:text-ui-fg-error hover:bg-ui-bg-error transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-ui-fg-muted disabled:hover:bg-transparent"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="currentColor"
                          >
                            <path
                              d="M1 1l8 8M9 1L1 9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Add row */}
              <tr>
                <td colSpan={10} className="py-2 px-3">
                  <button
                    onClick={addEmptyRow}
                    className="text-xs text-ui-fg-interactive hover:text-ui-fg-interactive-hover flex items-center gap-1"
                  >
                    + Adaugă produs
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex items-center gap-4 px-3 py-2 border-t border-ui-border-base bg-ui-bg-subtle">
            {!canProcess && pendingRows.length > 0 && (
              <Text size="small" className="text-ui-fg-muted">
                Adaugă cel puțin o imagine per produs pentru a activa generarea.
              </Text>
            )}
            {doneCount > 0 && (
              <Text size="small" className="text-ui-fg-positive">
                ✓ {doneCount} create
              </Text>
            )}
            {errorCount > 0 && (
              <Text size="small" className="text-ui-fg-error">
                ✗ {errorCount} erori
              </Text>
            )}
          </div>
        )}
      </Container>

      {rows.length === 0 && (
        <div className="text-center py-16 text-ui-fg-muted">
          <Text size="small">
            Importă un CSV sau adaugă produse manual cu butonul "+ Adaugă
            produs"
          </Text>
        </div>
      )}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "AI Generator",
});

export default AIProductPage;
