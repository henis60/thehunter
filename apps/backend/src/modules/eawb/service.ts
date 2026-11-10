import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from "@medusajs/framework/types"

import { EuroparcelClient } from "./lib/client"
import { EawbOptions, EpPriceAddress, EpPriceContent } from "./lib/types"
import { buildContent, roundShippingPrice, toEpAddress } from "./lib/pricing"
import { EuroparcelApiError } from "./lib/errors"

type InjectedDependencies = {
  logger: Logger
}

// Resolved from-address id is cached for this long to avoid hitting Europarcel
// on every checkout price calculation.
const FROM_ADDRESS_TTL_MS = 5 * 60 * 1000

// Same bound for the billing address: it is edited in the Europarcel dashboard,
// so an unbounded cache would keep invoicing to a deleted address until the
// process restarts.
const BILLING_ADDRESS_TTL_MS = 5 * 60 * 1000

// Failures Europarcel reports for an order that is already gone / already
// cancelled — cancellation must be idempotent so retrying an order cancel does
// not blow up on the second pass.
function isAlreadyCancelled(err: unknown): boolean {
  if (!(err instanceof EuroparcelApiError)) return false
  if (err.status === 404 || err.status === 410) return true
  // „already/deja canceled|anulat", dar și „is/has been/este/a fost canceled|
  // anulat" (cancel+ed: și varianta britanică „cancelled"), pe lângă „not found".
  // Mesajul exact al Europarcel pentru o a doua anulare nu e documentat nicăieri
  // unde am putut citi, deci lista e o estimare; ?already_canceled=true din
  // widget e plasa de siguranță când tot nu se potrivește.
  return /(already|deja)\s+(been\s+)?(cancel+ed|anulat)|(is|este|has\s+been|a\s+fost)\s+(cancel+ed|anulat)|not\s+found/i.test(
    err.detail
  )
}

export default class EawbFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "eawb"

  protected readonly logger_: Logger
  protected readonly options_: EawbOptions
  protected readonly client_: EuroparcelClient
  private billingAddressId_: number | null = null
  private billingAddressIdAt_ = 0
  private fromAddressId_: number | null = null
  private fromAddressIdAt_ = 0

  constructor({ logger }: InjectedDependencies, options: EawbOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client_ = new EuroparcelClient(options.api_key)
  }

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `eAWB fulfillment provider requires the "api_key" option.`
      )
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private fromAddressEnv(): EpPriceAddress {
    return {
      contact: this.options_.from_contact ?? "",
      phone: this.options_.from_phone ?? "",
      locality_name: this.options_.from_locality ?? "",
      county_name: this.options_.from_county ?? "",
      street_name: this.options_.from_street ?? "",
      street_number: this.options_.from_street_no ?? "",
      postal_code: this.options_.from_zip ?? "",
      country_code: this.options_.from_country ?? "RO",
    }
  }

  // Always uses the default shipping address configured in the Europarcel
  // account (falls back to the first one). Cached for FROM_ADDRESS_TTL_MS.
  private async resolveFromAddressId(): Promise<number | null> {
    const now = Date.now()
    if (this.fromAddressId_ !== null && now - this.fromAddressIdAt_ < FROM_ADDRESS_TTL_MS) {
      return this.fromAddressId_
    }

    let id: number | null = null
    try {
      const res = await this.client_.getShippingAddresses({ all: true })
      const def = res.list?.find((a) => a.is_default) ?? res.list?.[0]
      if (def) id = def.id
    } catch (err) {
      const summary =
        err instanceof EuroparcelApiError
          ? `${err.kind} (${err.status})`
          : (err as Error).message
      this.logger_.warn(`eAWB: could not fetch shipping addresses: ${summary}`)
    }

    if (id) {
      this.fromAddressId_ = id
      this.fromAddressIdAt_ = now
    }
    return id
  }

  private async getFromAddressData(): Promise<EpPriceAddress> {
    const id = await this.resolveFromAddressId()
    if (id) {
      return { address_from_id: id }
    }
    return this.fromAddressEnv()
  }

  private async getBillingAddressId(): Promise<number> {
    const now = Date.now()
    if (
      this.billingAddressId_ &&
      now - this.billingAddressIdAt_ < BILLING_ADDRESS_TTL_MS
    ) {
      return this.billingAddressId_
    }

    const res = await this.client_.getBillingAddresses({ all: true })
    if (!res.list?.length) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "eAWB: no billing addresses configured in Europarcel account."
      )
    }
    this.billingAddressId_ = res.list[0].id
    this.billingAddressIdAt_ = now
    return this.billingAddressId_!
  }

  private buildContent(
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    totalWeight = 0.5
  ): EpPriceContent {
    return buildContent(items as Array<{ quantity?: number }>, totalWeight)
  }

  private toAddress(shippingAddress: Record<string, unknown>, email?: string): EpPriceAddress {
    return toEpAddress(shippingAddress, email)
  }

  // ─── AbstractFulfillmentProviderService implementation ──────────────────────

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    const [carriers, services] = await Promise.all([
      this.client_.getCarriers(),
      this.client_.getServices({ country_code: "RO" }),
    ])

    const carrierMap = new Map(carriers.map((c) => [c.id, c.name]))

    return services
      .filter((s) => {
        const carrier = carrierMap.get(s.carrier_id)
        return carrier !== undefined
      })
      .map((s) => ({
        id: `eawb_${s.carrier_id}_${s.service_id}`,
        name: `${carrierMap.get(s.carrier_id) ?? s.carrier_name} — ${s.service_name}`,
        carrier_id: s.carrier_id,
        service_id: s.service_id,
      }))
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return !!(data.carrier_id && data.service_id)
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: unknown
  ): Promise<Record<string, unknown>> {
    return {
      ...data,
      carrier_id: optionData.carrier_id,
      service_id: optionData.service_id,
    }
  }

  async canCalculate(_data: unknown): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const shippingAddress = context.shipping_address as Record<string, unknown> | undefined

    if (!shippingAddress?.city) {
      return { calculated_amount: 0, is_calculated_price_tax_inclusive: false }
    }

    try {
      const billingAddressId = await this.getBillingAddressId()

      // Produsele în dropshipping pleacă de la furnizor, nu în coletul nostru:
      // ruta /store/carts/:id/profile-shipping-method pune id-urile lor pe
      // `data` metodei eAWB, ca greutatea să le excludă.
      const dropshipProductIds = new Set(
        ((data as any)?.dropship_product_ids as string[] | undefined) ?? []
      )
      const content = buildContent(
        (((context as any)?.items as Array<{ quantity?: number; product_id?: string }>) ?? [])
          .filter((i) => !i.product_id || !dropshipProductIds.has(i.product_id))
      )
      const parcel = content.parcels?.[0]?.size

      const res = await this.client_.calculatePrices({
        carrier_id: optionData.carrier_id as string | number,
        service_id: optionData.service_id as number,
        billing_to: { billing_address_id: billingAddressId },
        address_from: await this.getFromAddressData(),
        address_to: this.toAddress(shippingAddress),
        // Aceleași dimensiuni ca la emiterea AWB-ului. Erau scrise direct aici,
        // deci prețul afișat la checkout se putea abate de la coletul chiar
        // expediat — acum ambele trec prin buildContent.
        content,
        extra: { parcel_content: "Produse" },
      })

      const option = res.data?.[0]
      if (!option) {
        this.logger_.warn(
          `eAWB: niciun tarif returnat pentru carrier=${optionData.carrier_id} ` +
            `service=${optionData.service_id} → 0 RON`
        )
        return { calculated_amount: 0, is_calculated_price_tax_inclusive: false }
      }

      // Ce am trimis și ce a răspuns, pe o linie: fără asta nu se poate
      // distinge „dimensiunile nu s-au aplicat" de „curierul chiar atât cere".
      this.logger_.info(
        `eAWB tarif: ${parcel?.length}×${parcel?.width}×${parcel?.height}cm ` +
          `${content.total_weight}kg (vol=${(
            ((parcel?.length ?? 0) * (parcel?.width ?? 0) * (parcel?.height ?? 0)) /
            6000
          ).toFixed(2)}kg) carrier=${optionData.carrier_id} ` +
          `service=${optionData.service_id} → net=${option.price.amount} ` +
          `tva=${option.price.vat} total=${option.price.total} ` +
          `(rotunjit ${roundShippingPrice(option.price.total)}, cu TVA inclus)`
      )

      // `price.total` e CU TVA (= price.amount + price.vat), deci îl declarăm
      // ca atare, la fel ca restul prețurilor din magazin (vezi
      // scripts/set-ron-tax-inclusive.ts). Azi steagul nu schimbă nimic
      // vizibil — nu există o cotă de taxă aplicată livrării, iar clientul
      // vede exact prețul Europarcel cu TVA, rotunjit (15,50 → 16). Contează
      // doar dacă se activează taxele automate: cu `false`, Medusa ar adăuga
      // atunci TVA peste o sumă care îl conține deja.
      return {
        calculated_amount: roundShippingPrice(option.price.total),
        is_calculated_price_tax_inclusive: true,
      }
    } catch (err) {
      // Pricing still degrades to 0 (checkout must not break), but log the kind
      // and status only — Europarcel echoes the submitted recipient address back
      // in its error bodies, which we must not write to logs.
      const summary =
        err instanceof EuroparcelApiError
          ? `${err.kind} (${err.status}) on ${err.method} ${err.path}`
          : (err as Error).message
      this.logger_.warn(`eAWB calculatePrice failed: ${summary}`)
      return { calculated_amount: 0, is_calculated_price_tax_inclusive: false }
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    if (this.options_.dry_run) {
      this.logger_.warn("eAWB: DRY_RUN — skipping real AWB creation.")
      return {
        data: { europarcel_id: 0, awb: "DRY000", dry_run: true },
        labels: [{ tracking_number: "DRY000", tracking_url: "#", label_url: "#" }],
      }
    }

    const shippingAddress = order?.shipping_address as Record<string, unknown> | undefined
    if (!shippingAddress) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "eAWB: order has no shipping address."
      )
    }

    // The courier calls the recipient on delivery, so a real phone is mandatory
    // for an actual AWB — never fall back to a placeholder here.
    if (!(shippingAddress.phone as string)?.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "eAWB: comanda nu are număr de telefon pe adresa de livrare — necesar pentru AWB."
      )
    }

    const billingAddressId = await this.getBillingAddressId()
    const content = this.buildContent(items)

    // For "...to locker" services the customer picked a specific locker at
    // checkout; its id is carried on the shipping method data. Europarcel then
    // only needs the recipient contact + the locker id, not a street address.
    const recipient = this.toAddress(shippingAddress, order?.email ?? undefined)
    const fixedLocationId = data.fixed_location_id
      ? Number(data.fixed_location_id)
      : undefined
    // For locker delivery Europarcel still validates the full address (country,
    // locality, street) — the locker id is sent ON TOP to route the parcel to
    // the chosen locker.
    const addressTo = fixedLocationId
      ? { ...recipient, fixed_location_id: fixedLocationId }
      : recipient

    const orderRequest = {
      carrier_id: data.carrier_id,
      service_id: data.service_id,
      billing_to: { billing_address_id: billingAddressId },
      address_from: await this.getFromAddressData(),
      address_to: addressTo,
      content,
      extra: {
        parcel_content:
          items
            .map((i) => i.title)
            .filter(Boolean)
            .join(", ") || "Produse",
      },
    }

    let created: Awaited<ReturnType<EuroparcelClient["createOrder"]>>
    try {
      created = await this.client_.createOrder(orderRequest as Record<string, unknown>)
    } catch (err) {
      // Nothing was created (or we never learned an id), so there is no charge
      // to strand — just make the cause actionable for the admin retrying.
      if (err instanceof EuroparcelApiError) {
        throw new MedusaError(
          err.retryable ? MedusaError.Types.UNEXPECTED_STATE : MedusaError.Types.INVALID_DATA,
          err.userMessage
        )
      }
      throw err
    }

    if (!created?.awb) {
      // The Europarcel order EXISTS and the wallet was already charged. Throwing
      // here would roll the fulfillment back and lose the only reference to that
      // charge, leaving an unrecoverable orphan. So we persist the created order
      // id as a normal fulfillment instead and flag it: the AWB can be pulled
      // later via order-status, or the order cancelled (refunding the wallet)
      // through the same europarcel_id.
      this.logger_.error(
        `eAWB: Europarcel order ${created?.id ?? "unknown"} created without an AWB ` +
          `(order ${order?.id ?? "unknown"}) — persisting id so the charge stays recoverable.`
      )

      if (!created?.id) {
        // No id came back either; nothing is recoverable, so fail loudly.
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "eAWB: Europarcel a răspuns fără id de comandă și fără AWB. Verifică manual contul Europarcel înainte de a reîncerca."
        )
      }

      return {
        data: {
          europarcel_id: created.id,
          awb: "",
          awb_missing: true,
          carrier_name: created.carrier_name ?? "",
          service_name: created.service_name ?? "",
          track_url: created.track_url ?? "",
        },
        labels: [],
      }
    }

    return {
      data: {
        europarcel_id: created.id,
        awb: created.awb,
        carrier_name: created.carrier_name,
        service_name: created.service_name,
        track_url: created.track_url ?? "",
      },
      labels: [
        {
          tracking_number: created.awb,
          tracking_url: created.track_url ?? "",
          label_url: "",
        },
      ],
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<void> {
    if (data.dry_run) {
      this.logger_.warn("eAWB: DRY_RUN — skipping real AWB cancellation.")
      return
    }

    // Operatorul a confirmat că AWB-ul e deja anulat în contul Europarcel (setat
    // de ruta /admin/eawb/cancel cu ?already_canceled=true). Nu mai lovim
    // Europarcel: un răspuns neașteptat la o a doua anulare bloca altfel
    // anularea și în Medusa.
    if (data.courier_cancel_skipped) {
      this.logger_.warn(
        `eAWB: anulare la curier omisă pentru comanda Europarcel ${String(data.europarcel_id ?? "?")} ` +
          `(marcată de operator ca deja anulată).`
      )
      return
    }

    const europarcelId = Number(data.europarcel_id)
    if (!europarcelId || Number.isNaN(europarcelId)) {
      // Fulfillment never reached Europarcel — nothing to cancel there.
      return
    }

    try {
      await this.client_.cancelOrder(europarcelId, "wallet")
      this.logger_.info(`eAWB: cancelled Europarcel order ${europarcelId}.`)
    } catch (err) {
      // Idempotent: an order Europarcel no longer knows about is already in the
      // state we want, so a repeated cancel must not block the Medusa cancel.
      if (isAlreadyCancelled(err)) {
        this.logger_.info(
          `eAWB: Europarcel order ${europarcelId} already cancelled/unknown — treating as cancelled.`
        )
        return
      }
      if (err instanceof EuroparcelApiError) {
        // Surfaced with the kind so an admin can tell "retry" from "call them" —
        // the parcel may still be picked up until this succeeds.
        this.logger_.error(
          `eAWB: failed to cancel Europarcel order ${europarcelId} [${err.kind}/${err.status}]: ${err.detail}`
        )
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, err.userMessage)
      }
      throw err
    }
  }

  async createReturnFulfillment(_fulfillment: Record<string, unknown>): Promise<CreateFulfillmentResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "eAWB nu suportă creare automată de retur. Gestionează retururile direct din dashboardul Europarcel."
    )
  }

  async getFulfillmentDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async retrieveDocuments(_fulfillmentData: Record<string, unknown>, _documentType: string): Promise<void> {
    // Label URLs are fetched on-demand via GET /admin/eawb/label/:fulfillmentId
  }

  async getReturnDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async getShipmentDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return []
  }
}
