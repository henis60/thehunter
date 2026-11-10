/**
 * Numele sub care un produs din Medusa apare în Oblio.
 *
 * Oblio nu acceptă orice denumire pe factură: produsele de tip „Marfa" trebuie
 * să existe în nomenclatorul lor, într-o gestiune. Trimițând titlul din Medusa,
 * de exemplu „Batistă de Buzunar Medalion Ornamental", Oblio răspunde cu 400
 * („nu este in gestiunea … din punctul de lucru Sediu").
 *
 * Regula, în ordinea priorității:
 *  1. metadata `oblio` pe PRODUS (Admin → produs → Metadata) — pentru o
 *     excepție de la categoria lui;
 *  2. metadata `oblio` pe CATEGORIA produsului (Admin → Categorii → Metadata)
 *     — de ex. categoria „Shoes" cu `oblio` = „Pantofi";
 *  3. NUMELE categoriei.
 * Valoarea trebuie să existe în nomenclatorul Oblio EXACT așa (litere mari/mici
 * și diacritice incluse). O categorie nouă pe site cere doar un produs cu
 * același nume în Oblio (sau metadata `oblio`) — fără modificări de cod.
 *
 * Nu se ghicește nimic. Un produs fără categorie, sau cu mai multe categorii
 * care duc la nume Oblio diferite (nu știm care e cea fiscală), oprește factura
 * cu o eroare care îl numește — un document fiscal pe categoria greșită costă
 * mai mult decât unul întârziat. Metadata `oblio` pe produs rezolvă ambele
 * cazuri.
 */

export const OBLIO_METADATA_KEY = "oblio"

// Câmpurile de cerut în query.graph pentru linia de comandă.
export const OBLIO_ITEM_FIELDS = [
  "items.variant.product.title",
  "items.variant.product.metadata",
  "items.variant.product.categories.name",
  "items.variant.product.categories.metadata",
]

type Metadata = Record<string, unknown> | null | undefined

type Item = {
  title?: string | null
  variant?: {
    product?: {
      title?: string | null
      metadata?: Metadata
      categories?: Array<{ name?: string | null; metadata?: Metadata }> | null
    } | null
  } | null
}

export type OblioNameResult =
  | { name: string }
  | { error: string }

const oblioMeta = (metadata: Metadata): string | null => {
  const v = metadata?.[OBLIO_METADATA_KEY]
  return typeof v === "string" && v.trim() ? v.trim() : null
}

export function oblioProductName(item: Item): OblioNameResult {
  const product = item.variant?.product
  const label = item.title ?? product?.title ?? "produs fără titlu"

  const fromProduct = oblioMeta(product?.metadata)
  if (fromProduct) return { name: fromProduct }

  const names = [
    ...new Set(
      (product?.categories ?? [])
        .map((c) => oblioMeta(c.metadata) ?? c.name?.trim())
        .filter((n): n is string => !!n)
    ),
  ]

  if (names.length === 1) return { name: names[0] }

  return {
    error:
      names.length === 0
        ? `„${label}" nu are nicio categorie (nici metadata „${OBLIO_METADATA_KEY}" pe produs)`
        : `„${label}" are mai multe categorii cu nume Oblio diferite (${names.join(", ")}) ` +
          `și nu știu care e cea fiscală — pune metadata „${OBLIO_METADATA_KEY}" pe produs`,
  }
}
