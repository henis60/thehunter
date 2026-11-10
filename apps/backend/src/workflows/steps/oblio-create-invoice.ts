import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { requireOblioCui, requireOblioManagement } from "./oblio-get-token"
import { OBLIO_ITEM_FIELDS, oblioProductName } from "../../lib/oblio-product-name"
import { countryNameRo } from "../../lib/country-name"

type Input = {
  order_id: string
  token: string
}

type InvoiceResult = {
  series: string
  number: string
  // Link-ul către PDF, întors de Oblio la emitere. E calea preferată de
  // descărcare: SDK-ul oficial nu expune niciun endpoint de download.
  link?: string
}

export const oblioCreateInvoiceStep = createStep(
  "oblio-create-invoice",
  async ({ order_id, token }: Input, { container }) => {
    const logger = container.resolve("logger")

    if (process.env.OBLIO_DRY_RUN === "true") {
      logger.info(`Oblio DRY_RUN: factură fictivă pentru comanda ${order_id}`)
      return new StepResponse({ series: "TEST", number: "0001" } as InvoiceResult)
    }

    const query = container.resolve("query")
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "shipping_total",
        "total",
        "discount_total",
        "metadata",
        "customer.first_name",
        "customer.last_name",
        "billing_address.first_name",
        "billing_address.last_name",
        "billing_address.address_1",
        "billing_address.city",
        "billing_address.province",
        "billing_address.country_code",
        "billing_address.company",
        "billing_address.phone",
        "items.id",
        "items.title",
        ...OBLIO_ITEM_FIELDS,
        "items.quantity",
        "items.unit_price",
        "items.adjustments.amount",
      ],
      filters: { id: order_id },
    })

    const order = orders?.[0]
    if (!order) {
      throw new Error(`Comanda ${order_id} negăsită`)
    }

    // Idempotență: dacă factura există deja, returnează datele existente
    if (order.metadata?.oblio_invoice_number) {
      logger.info(
        `Factură existentă pentru comanda ${order_id}: ` +
        `${order.metadata.oblio_invoice_series}/${order.metadata.oblio_invoice_number}`
      )
      return new StepResponse({
        series: order.metadata.oblio_invoice_series as string,
        number: order.metadata.oblio_invoice_number as string,
      } as InvoiceResult)
    }

    // Obligatoriu în payload — aruncă devreme, cu mesaj clar, în loc să trimită
    // `cif: undefined` și să primească o eroare obscură de la Oblio.
    const cui = requireOblioCui()
    const seriesName = process.env.OBLIO_INVOICE_SERIES ?? "FCT"
    // Romania's standard VAT rate is 21% (the previous 19% default silently
    // under-declared VAT on every invoice issued without the env var set).
    const vatPercentage = parseInt(process.env.OBLIO_VAT_PERCENTAGE ?? "21", 10)
    const currency = (order.currency_code ?? "RON").toUpperCase()
    const today = new Date().toISOString().split("T")[0]

    const billing = order.billing_address ?? {}
    const clientName =
      (billing as any).company ||
      `${(billing as any).first_name ?? order.customer?.first_name ?? ""} ${(billing as any).last_name ?? order.customer?.last_name ?? ""}`.trim() ||
      order.email

    // Unit price AFTER any discount applied to the line.
    //
    // `unit_price` already reflects a price-list sale (Medusa bakes the
    // calculated/sale amount into unit_price at add-to-cart time — see
    // prepareLineItemData in @medusajs/core-flows — so no further adjustment
    // is needed for that case). A cart-level promotion/coupon is different:
    // it's applied as a separate `LineItemAdjustment`, not folded into
    // unit_price, so it has to be subtracted explicitly.
    //
    // `OrderLineItem` has no persisted total/subtotal/discount_total column
    // (only unit_price, compare_at_unit_price and the adjustments relation —
    // see @medusajs/order's line-item model) — those are decorated onto the
    // entity by the order module's own service, not something `query.graph`
    // reliably resolves. Computing from unit_price + adjustments directly
    // avoids depending on a field that silently came back empty here.
    //
    // The discount is folded into the unit price rather than sent as a separate
    // Oblio discount line: that keeps the invoice total equal to the order
    // total by construction. Itemising it instead would mean relying on Oblio's
    // discount-line semantics, which are not verifiable from here.
    const effectiveUnitPrice = (item: any): number => {
      const quantity = Number(item.quantity ?? 1) || 1
      const unitPrice = Number(item.unit_price ?? 0)
      const adjustmentTotal = (item.adjustments ?? []).reduce(
        (sum: number, adj: any) => sum + (Number(adj.amount) || 0),
        0
      )
      return unitPrice - adjustmentTotal / quantity
    }

    // Pe factură merge numele din nomenclatorul Oblio, nu titlul din Medusa:
    // metadata `oblio` pe produs → metadata `oblio` pe categorie → numele
    // categoriei (vezi lib/oblio-product-name.ts). Fără un nume clar se
    // oprește, cu produsele numite — nu ghicim o clasificare fiscală.
    const resolved = (order.items ?? []).map((item: any) => ({
      item,
      result: oblioProductName(item),
    }))
    const problems = resolved.flatMap((r) =>
      "error" in r.result ? [r.result.error] : []
    )
    if (problems.length) {
      throw new Error(
        `Oblio: ${problems.join("; ")}. Fiecare produs trebuie să ducă la un singur ` +
          `nume din nomenclatorul Oblio: metadata „oblio" pe produs sau pe categorie, ` +
          `altfel numele categoriei, scris identic.`
      )
    }

    const management = requireOblioManagement()

    // Factura se emite după ce plata e deja confirmată la Netopia, deci o
    // marcăm încasată în Oblio. Fără `collect` rămânea „Neincasata (rest de
    // încasat …)", deși clientul plătise. Oblio cere `documentNumber` când
    // încasarea nu e chitanță: folosim ID-ul tranzacției Netopia, ca să se
    // poată reconcilia cu extrasul. Interogarea e separată și învelită în
    // try, ca o cale de câmp nepotrivită să nu poată opri emiterea facturii.
    let collectRef = `Comanda ${order.display_id ?? order_id}`
    try {
      const { data: payOrders } = await query.graph({
        entity: "order",
        fields: ["payment_collections.payments.data"],
        filters: { id: order_id },
      })
      const ntpID = ((payOrders?.[0] as any)?.payment_collections ?? [])
        .flatMap((pc: any) => pc?.payments ?? [])
        .map((p: any) => p?.data?.ntpID)
        .find(Boolean)
      if (ntpID) collectRef = `Netopia ${ntpID}`
    } catch (err) {
      logger.warn(
        `Oblio: nu am putut citi ntpID pentru comanda ${order_id} (${(err as Error).message}) — ` +
          `încasarea se înregistrează cu referința „${collectRef}"`
      )
    }
    // Punctul de lucru căruia îi aparține gestiunea. Oblio are „Sediu" ca
    // valoare implicită; dacă gestiunea e la alt punct de lucru, produsul nu
    // se găsește: „nu este in gestiunea `X` din punctul de lucru `Sediu`".
    // Nu se trimite nimic dacă variabila lipsește, ca să păstrăm implicitul.
    const workStation = process.env.OBLIO_WORK_STATION?.trim() || undefined

    const products = resolved.map(({ item, result }): Record<string, any> => ({
      name: (result as { name: string }).name,
      // Titlul real rămâne vizibil pe factură, ca descriere.
      description: item.title,
      // Fără cod: id-ul liniei de comandă nu există în nomenclatorul Oblio și
      // ar putea împiedica potrivirea după nume.
      code: "",
      price: effectiveUnitPrice(item),
      measuringUnit: "buc",
      currency,
      vatName: "Normala",
      vatPercentage,
      vatIncluded: true,
      quantity: item.quantity ?? 1,
      // Doar valori din lista Oblio — „Produs" simplu e respins cu 400.
      productType: "Marfa",
      // Gestiunea din care e marfa. Cerută de Oblio pe produsele stocabile; nu
      // se aplică serviciilor, deci linia de transport de mai jos n-o primește.
      management,
      isDiscount: false,
      saveToDb: false,
    }))

    const shippingTotal = Number((order as any).shipping_total ?? 0)
    if (shippingTotal > 0) {
      products.push({
        name: "Transport",
        description: "",
        code: "shipping",
        price: shippingTotal,
        measuringUnit: "buc",
        currency,
        vatName: "Normala",
        vatPercentage,
        vatIncluded: true,
        quantity: 1,
        productType: "Serviciu",
        isDiscount: false,
        saveToDb: false,
      })
    }

    // An invoice that disagrees with what was charged is a fiscal problem that
    // can only be undone with a storno, so check the arithmetic before sending
    // rather than discovering it from a customer complaint. Rounding to two
    // decimals per unit can legitimately drift a bani or two on quantities that
    // don't divide evenly, hence the tolerance.
    const invoiceTotal = products.reduce(
      (sum, product) => sum + product.price * Number(product.quantity ?? 1),
      0
    )
    const orderTotal = Number((order as any).total ?? 0)
    if (Number.isFinite(orderTotal) && orderTotal > 0) {
      const drift = Math.abs(invoiceTotal - orderTotal)
      if (drift > 0.05) {
        logger.warn(
          `Oblio: totalul facturii (${invoiceTotal.toFixed(2)} ${currency}) diferă de ` +
          `totalul comenzii ${order_id} (${orderTotal.toFixed(2)} ${currency}). ` +
          `Verifică reducerile și transportul înainte de a trimite factura clientului.`
        )
      }
    }

    // Ce trimitem, fără date personale: suficient ca să reconstitui o factură
    // greșită din loguri, fără să le transformi în arhivă de clienți.
    logger.info(
      `Oblio → emitere pentru comanda ${order_id}: cif=${cui} serie=${seriesName} ` + `moneda=${currency} tva=${vatPercentage}% ` +
        `linii=${products.length} tipuri=${[...new Set(products.map((p) => p.productType))].join("/")} ` +
        `useStock=0 gestiune=${management} ` +
        `punctLucru=${workStation ?? "Sediu (implicit)"} incasare=Card/${collectRef} ` +
        `total=${invoiceTotal.toFixed(2)} ` +
        `referinta=${String(order.display_id ?? order_id)}`
    )

    // Endpoint-ul documentat e per tip de document: /api/docs/invoice.
    // Vechiul /business/api/docs întoarce 404 (verificat).
    const response = await fetch("https://www.oblio.eu/api/docs/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cif: cui,
        client: {
          name: clientName,
          address: (billing as any).address_1 ?? "",
          state: (billing as any).province ?? "",
          city: (billing as any).city ?? "",
          country: countryNameRo((billing as any).country_code),
          phone: (billing as any).phone ?? "",
          email: order.email ?? "",
        },
        // Încasarea prin card (Netopia). `value` lipsește intenționat: implicit
        // e totalul facturii. Tipul „Card" e din lista Oblio; dacă
        // contabilitatea îl preferă altfel (ex. „Alta incasare banca"),
        // se schimbă aici.
        collect: {
          type: "Card",
          documentNumber: collectRef,
          issueDate: today,
        },
        issueDate: today,
        dueDate: today,
        deliveryDate: today,
        reference: String(order.display_id ?? order_id),
        language: "RO",
        precision: 2,
        currency,
        products,
        // Tipul documentului e dat de URL (/api/docs/invoice), nu de un câmp
        // din corp — așa funcționează API-ul Oblio. Un `type` aici era ignorat,
        // deci OBLIO_DOCUMENT_TYPE promitea ceva ce nu putea livra: setat pe
        // "Proforma" tot o factură fiscală ar fi emis.
        seriesName,
        // Întreg 0/1, nu boolean (documentația Oblio, exemplul SDK oficial:
        // 'useStock' => 0). Cu `false`, produsele de tip „Marfa" erau căutate
        // în gestiune: „nu este in gestiunea `` din punctul de lucru `Sediu`".
        useStock: 0,
        ...(workStation ? { workStation } : {}),
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error(
        `Oblio ✗ emitere HTTP ${response.status} pentru comanda ${order_id}: ${text.slice(0, 500)}`
      )
      throw new Error(`Oblio creare factură eșuată: ${response.status} — ${text}`)
    }

    const data = await response.json()
    // Oblio răspunde { status, statusMessage, data: { seriesName, number, link… } }
    // — datele facturii sunt în `data.data`. Citite din rădăcină, numărul
    // lipsea, iar pasul de PDF cerea un document fără număr.
    const model = data.data ?? data.model ?? data

    // Oblio poate răspunde 200 cu un status de eroare în corp; fără linia asta
    // un eșec ar arăta identic cu un succes.
    if (data?.status !== undefined && data.status !== 200) {
      logger.error(
        `Oblio ✗ emitere respinsă pentru comanda ${order_id}: ` +
          `status=${data.status} message=${data.statusMessage ?? "-"}`
      )
    }

    const series = model.seriesName ?? seriesName
    const number = String(model.number ?? "")

    if (!number) {
      // Oblio a răspuns cu succes (HTTP 2xx), deci factura a fost, cel mai
      // probabil, EMISĂ — doar că nu i-am găsit numărul. Nu mergem mai departe
      // (PDF, metadata) cu un număr gol, iar mesajul avertizează să nu se
      // regenereze înainte de a verifica în Oblio: ar ieși un duplicat fiscal.
      logger.error(
        `Oblio: răspuns fără număr de factură pentru comanda ${order_id} — ` +
          `chei primite: ${Object.keys(model ?? {}).join(", ")} — ` +
          `răspuns: ${JSON.stringify(data).slice(0, 500)}`
      )
      throw new Error(
        `Oblio a răspuns cu succes, dar fără număr de factură (comanda ${order_id}). ` +
          `Factura a fost probabil emisă — VERIFICĂ în Oblio înainte de a o genera ` +
          `din nou, altfel apare un duplicat.`
      )
    } else {
      logger.info(
        `Oblio ← factură emisă ${series}/${number} pentru comanda ${order_id} ` +
          `(link=${model.link ?? "-"})`
      )
    }

    return new StepResponse({
      series,
      number,
      link: typeof model.link === "string" ? model.link : undefined,
    } as InvoiceResult)
  }
)
