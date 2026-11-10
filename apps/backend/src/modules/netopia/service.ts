import {
  AbstractPaymentProvider,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdateAccountHolderInput,
  UpdateAccountHolderOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";

import { NetopiaClient } from "./lib/client";
import {
  NetopiaOptions,
  NetopiaIpnPayload,
  NetopiaBrowserInfo,
} from "./lib/types";
import { NetopiaStatus } from "./lib/status";
import { toE164RoPhone } from "../../lib/phone";

type InjectedDependencies = {
  logger: Logger;
  [key: string]: unknown;
};

// PaymentSessionStatus string literals
const PS = {
  pending: "pending" as const,
  authorized: "authorized" as const,
  captured: "captured" as const,
  error: "error" as const,
  canceled: "canceled" as const,
};

// Why the extra "reason": pending is the right conservative status for both
// "3DS still running" and "code we've never seen", but collapsing them loses
// the signal that something is wrong. The status stays identical; only the
// diagnostics differ.
type StatusReason =
  | "settled"
  | "rejected"
  | "canceled"
  | "refunded"
  | "pending_3ds"
  | "initiated"
  | "unknown";

function classifyStatus(code: number | undefined): {
  status: (typeof PS)[keyof typeof PS];
  reason: StatusReason;
} {
  switch (code) {
    case NetopiaStatus.CONFIRMED:
    case NetopiaStatus.PAID:
      return { status: PS.authorized, reason: "settled" };

    // Eșecuri terminale — plata nu se va mai autoriza niciodată. Fără ele,
    // aceste coduri cădeau pe `default` și rămâneau `pending` la infinit,
    // adică un card refuzat ținea checkout-ul blocat în loc să dea eroare.
    case NetopiaStatus.ERROR:
    case NetopiaStatus.DECLINED:
    case NetopiaStatus.FRAUD:
    case NetopiaStatus.EXPIRED:
      return { status: PS.error, reason: "rejected" };

    case NetopiaStatus.CANCELED:
    case NetopiaStatus.CANCELED_PROGRAMMED:
      return { status: PS.canceled, reason: "canceled" };

    // Bani întorși clientului după o plată confirmată.
    case NetopiaStatus.CREDIT:
    case NetopiaStatus.REVERSED:
    case NetopiaStatus.CHARGEBACK_ACCEPT:
      return { status: PS.canceled, reason: "refunded" };

    case NetopiaStatus.THREE_DS_AUTH:
      return { status: PS.pending, reason: "pending_3ds" };
    case NetopiaStatus.NEW:
    case NetopiaStatus.OPENED:
    case NetopiaStatus.PENDING:
    case NetopiaStatus.PENDING_AUTH:
    case NetopiaStatus.PENDING_ANY:
      return { status: PS.pending, reason: "initiated" };
    default:
      return { status: PS.pending, reason: "unknown" };
  }
}

function toNumber(amount: unknown): number {
  let n: number;

  if (typeof amount === "number") {
    n = amount;
  } else if (typeof amount === "string") {
    n = parseFloat(amount);
  } else if (amount && typeof amount === "object") {
    // Medusa dă suma în trei forme, după locul din care vine:
    //  - instanță BigNumber            → are `numeric` (și valueOf() util)
    //  - obiect brut `{ value, precision }` → `refund.raw_amount`, pe care îl
    //    primește refundPayment. valueOf() al unui obiect simplu întoarce
    //    chiar obiectul, iar Number({…}) e NaN — de aceea rambursarea arunca
    //    „Invalid payment amount" și cererea nu pleca niciodată la Netopia.
    //  - `{ raw: { value } }`          → același lucru, învelit.
    const a = amount as Record<string, any>;
    const candidate =
      a.numeric ?? a.value ?? a.raw?.value ?? a.valueOf?.();
    n = typeof candidate === "object" ? NaN : Number(candidate);
  } else {
    n = NaN;
  }

  if (!Number.isFinite(n))
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid payment amount: ${JSON.stringify(amount)}`,
    );
  return n;
}

function getNtpID(data: Record<string, unknown>): string | undefined {
  return data?.ntpID as string | undefined;
}

export class NetopiaProviderService extends AbstractPaymentProvider<NetopiaOptions> {
  static identifier = "netopia";

  private readonly client: NetopiaClient;
  private readonly options: NetopiaOptions;
  private readonly logger: Logger;
  private readonly deps: InjectedDependencies;

  constructor(container: InjectedDependencies, options: NetopiaOptions) {
    super(container, options);
    this.options = options;
    this.logger = container.logger;
    this.client = new NetopiaClient(options, {
      info: (msg) => this.logger.info(msg),
      error: (msg) => this.logger.error(msg),
    });
    this.deps = container;
  }

  static validateOptions(options: Record<string, unknown>): void {
    const required = ["apiKey", "posSignature"];
    const missing = required.filter((k) => !options[k]);
    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Netopia provider missing required options: ${missing.join(", ")} (set NETOPIA_API_KEY and NETOPIA_ID)`,
      );
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    // Nu mai există niciun blocaj al checkout-ului: nici aici, nici în
    // storefront. Singurul semnal rămas e avertismentul de mai jos.
    //
    // Consecința, cât timp `sandbox` e adevărat: un checkout "reușit" NU
    // încasează bani reali, deci o comandă poate ajunge finalizată fără plată.
    // Treci NETOPIA_TEST_MODE pe "false" înainte de a lăsa magazinul accesibil
    // publicului.
    if (this.options.sandbox) {
      this.logger.warn(
        "Netopia: SANDBOX activ — plățile NU încasează bani reali (NETOPIA_TEST_MODE != 'false')",
      );
    }

    const amountRON = toNumber(input.amount);
    const currency = (input.currency_code ?? "RON").toUpperCase();
    const ctx = (input.context as Record<string, unknown> | undefined) ?? {};
    // idempotency_key = payment session ID (ps_xxx) — Medusa îl folosește la matching IPN
    const sessionId = (ctx?.idempotency_key ??
      (ctx?.extra as any)?.session_id ??
      ctx?.session_id ??
      `sess_${Date.now()}`) as string;

    const inputData = (input.data ?? {}) as Record<string, unknown>;
    const billing = this.extractBilling(
      ctx,
      inputData.billing_address as Record<string, unknown> | undefined,
    );
    const browserInfo = inputData.browser_info as
      | NetopiaBrowserInfo
      | undefined;
    // Locale is stamped onto the redirect URL (rather than relying on the
    // storefront's locale cookie surviving the trip) because Netopia's
    // return can be a cross-site POST, which browsers never attach
    // SameSite cookies to — see the comment on initiateNetopiaPayment in
    // apps/storefront/src/lib/data/cart.ts.
    const locale = (inputData.locale as string | undefined) || "ro";
    const redirectUrl = `${this.options.redirectUrl}?session_id=${sessionId}&locale=${encodeURIComponent(locale)}`;

    // Ancora fiecărei plăți în loguri: de aici pornești căutarea după orderID
    // când vrei să reconstitui un checkout. Fără date personale.
    this.logger.info(
      `Netopia initiatePayment: orderID=${sessionId} amount=${amountRON} ${currency} ` +
        `locale=${locale} browserInfo=${browserInfo ? "da" : "nu"} ` +
        `notifyUrl=${this.options.notifyUrl}`,
    );

    let response;
    try {
      response = await this.client.startPayment({
        config: {
          notifyUrl: this.options.notifyUrl,
          redirectUrl,
          language: this.options.language,
        },
        order: {
          posSignature: this.options.posSignature,
          orderID: sessionId,
          dateTime: new Date().toISOString(),
          description: "Comandă online",
          amount: amountRON,
          currency,
          billing,
          shipping: billing,
          products: [
            {
              name: "Comandă",
              code: "ORDER",
              category: "general",
              price: amountRON,
              vat: 21,
            },
          ],
        },
        payment: {
          options: { installments: 0, bonus: 0 },
          instrument: {
            type: "card",
            account: "",
            expMonth: 0,
            expYear: 0,
            secretCode: "",
          },
          ...(browserInfo ? { data: browserInfo } : {}),
        },
      });
    } catch (err) {
      this.logger.error(
        `Netopia initiatePayment error: ${(err as Error).message}`,
      );
      throw err;
    }

    const paymentURL = response.payment?.paymentURL;
    const ntpID = response.payment?.ntpID ?? "";

    if (!paymentURL) {
      this.logger.error(
        `Netopia initiatePayment: no paymentURL — ${JSON.stringify(response)}`,
      );
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Netopia did not return a payment URL",
      );
    }

    // Leagă orderID-ul nostru de ntpID-ul Netopia — perechea asta e ce ai nevoie
    // ca să cauți o tranzacție în panoul lor pornind de la o comandă din Medusa.
    this.logger.info(
      `Netopia initiatePayment OK: orderID=${sessionId} ntpID=${ntpID || "-"} ` +
        `status=${String(response.payment?.status ?? "-")} redirect=da`,
    );

    return {
      id: ntpID || sessionId,
      data: {
        redirect_url: paymentURL,
        ntpID,
        orderID: sessionId,
        amountRON,
        currency,
        status: response.payment?.status ?? NetopiaStatus.NEW,
        // Read by the storefront to decide whether a second "Plătește" click
        // may reuse this still-open Netopia page instead of creating a new
        // session — which would delete this one and orphan any payment made
        // on it (see initiateNetopiaPayment in the storefront's cart.ts).
        initiated_at: new Date().toISOString(),
      },
    };
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const { status } = await this.getPaymentStatus({ data });
    return { status, data };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const ntpID = getNtpID(data);

    if (!ntpID) {
      this.logger.warn(
        `Netopia getPaymentStatus: missing ntpID (orderID=${String(data.orderID ?? "?")}) — returning pending`,
      );
      return { status: PS.pending, data };
    }

    try {
      const res = await this.client.getStatus(ntpID);
      const code = res.payment?.status;
      const { status, reason } = classifyStatus(code);

      const where = `ntpID=${ntpID} orderID=${String(data.orderID ?? "?")}`;

      if (reason === "unknown") {
        this.logger.warn(
          `Netopia getPaymentStatus: unknown status code ${String(code)} for ${where} — treating as pending`,
        );
      } else if (reason === "rejected" || reason === "canceled" || reason === "refunded") {
        // Eșecurile terminale trebuie să sară în ochi la live — până acum
        // arătau identic cu o plată încă în desfășurare.
        this.logger.warn(
          `Netopia plată neîncheiată: ${where} cod=${String(code)} motiv=${reason} → ${status}`,
        );
      } else {
        this.logger.info(
          `Netopia getPaymentStatus: ${where} cod=${String(code)} motiv=${reason} → ${status}`,
        );
      }

      return { status, data: { ...data, status: code, status_reason: reason } };
    } catch (err) {
      // Pending is still the correct conservative answer (a transport failure
      // is not evidence the payment failed), but it must be alertable: without
      // this, a gateway outage looks exactly like a slow customer.
      this.logger.error(
        `Netopia getPaymentStatus API failure — ntpID=${ntpID} ` +
          `orderID=${String(data.orderID ?? "?")} err=${(err as Error).name}: ` +
          `${(err as Error).message} — returning pending (status unknown)`,
      );
      return { status: PS.pending, data: { ...data, status_reason: "api_error" } };
    }
  }

  async capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const ntpID = getNtpID(data);

    if (!ntpID) return { data };

    // Plata cu cardul la Netopia se decontează direct, fără preautorizare
    // separată: când statusul e deja CONFIRMED, banii sunt încasați și nu mai
    // există ce captura. Apelul ar primi "Duplicate request" (errorCode 56),
    // pe care îl tratam ca succes — deci logam "capturată automat" pentru o
    // operație care de fapt eșuase. Întrebăm întâi statusul real.
    // NU folosi `data.status`: rămâne valoarea de la inițiere (1 = NEW).
    // Verificat empiric — Medusa creează `payment` din datele SESIUNII, nu din
    // cele întoarse de authorizePayment, deci statusul decontării nu ajunge
    // aici. Singura sursă de adevăr e o interogare proaspătă.
    let code: number | undefined;
    try {
      const res = await this.client.getStatus(ntpID);
      code = res.payment?.status;
    } catch (err) {
      // Fără status confirmat nu putem sări peste capture în siguranță —
      // mergem mai departe și încercăm.
      this.logger.warn(
        `Netopia capture: status necunoscut pentru ntpID=${ntpID} (${(err as Error).message}) — încerc capture`,
      );
    }

    if (code === NetopiaStatus.CONFIRMED) {
      this.logger.info(
        `Netopia capture omis: ntpID=${ntpID} deja CONFIRMED (${code}) — decontat la autorizare`,
      );
      return { data };
    }

    try {
      const amountRON = toNumber(data.amountRON ?? 0);
      const currency = (data.currency as string) ?? "RON";
      const res = await this.client.capture(ntpID, amountRON, currency);

      // Netopia raportează eșecurile în CORPUL răspunsului, cu HTTP 200 —
      // clientul nu are cum să le vadă, el verifică doar statusul HTTP. Fără
      // verificarea de mai jos, orice eroare (inclusiv 56 "Duplicate request")
      // era logată drept succes.
      const errCode = res.error?.code;
      if (errCode && errCode !== "00") {
        this.logger.warn(
          `Netopia capture NEEFECTUAT: ntpID=${ntpID} errorCode=${errCode} ` +
            `errorMessage=${res.error?.message ?? "-"} (status=${res.payment?.status ?? "-"})`,
        );
      } else {
        this.logger.info(`Netopia capture OK: ntpID=${ntpID}`);
      }
    } catch (err) {
      this.logger.warn(`Netopia capture error: ${(err as Error).message}`);
    }

    return { data };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const ntpID = getNtpID(data);

    if (!ntpID) return { data };

    try {
      await this.client.void(ntpID);
    } catch (err) {
      this.logger.warn(`Netopia void error: ${(err as Error).message}`);
    }

    return { data };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>;
    const ntpID = getNtpID(data);

    if (!ntpID) return { data };

    // Errors must propagate: swallowing them made Medusa record a refund that
    // Netopia had rejected, so the admin showed "refunded" with no money back.
    const amountRON = toNumber(input.amount);
    try {
      await this.client.refund(ntpID, amountRON);
    } catch (err) {
      this.logger.error(
        `Netopia refund FAILED ntpID=${ntpID} amount=${amountRON}: ${(err as Error).message}`,
      );
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Rambursarea Netopia a eșuat: ${(err as Error).message}`,
      );
    }

    this.logger.info(`Netopia refund OK ntpID=${ntpID} amount=${amountRON}`);
    return { data };
  }

  async deletePayment(
    _input: DeletePaymentInput,
  ): Promise<DeletePaymentOutput> {
    return {};
  }

  // Netopia nu are conceptul de "account holder" (customer profile la nivel de gateway).
  // Implementările sunt no-op ca să nu arunce erori când clientul e autentificat.
  async createAccountHolder(
    input: CreateAccountHolderInput,
  ): Promise<CreateAccountHolderOutput> {
    const customerId = (input.context?.customer?.id ?? "") as string;
    return { id: customerId, data: {} };
  }

  async updateAccountHolder(
    input: UpdateAccountHolderInput,
  ): Promise<UpdateAccountHolderOutput> {
    return {
      data: (input.context?.account_holder?.data ?? {}) as Record<
        string,
        unknown
      >,
    };
  }

  async deleteAccountHolder(
    _input: DeleteAccountHolderInput,
  ): Promise<DeleteAccountHolderOutput> {
    return { data: {} };
  }

  async retrievePayment(
    input: RetrievePaymentInput,
  ): Promise<RetrievePaymentOutput> {
    return { data: (input.data ?? {}) as Record<string, unknown> };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return this.initiatePayment(input as unknown as InitiatePaymentInput);
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    let ipn: NetopiaIpnPayload | undefined;

    try {
      const body = payload.data;
      const raw = payload.rawData;

      if (body && typeof body === "object" && (body as any).payment) {
        ipn = body as NetopiaIpnPayload;
      } else if (raw) {
        const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
        ipn = JSON.parse(text);
      }
    } catch {
      return { action: "not_supported" };
    }

    const status = ipn?.payment?.status;
    const orderID = ipn?.order?.orderID ?? "";
    const amount = ipn?.payment?.amount ?? 0;
    const currency = (
      ipn?.payment?.currency ??
      ipn?.order?.currency ??
      ""
    ).toUpperCase();

    const { status: mapped, reason } = classifyStatus(status);

    if (reason === "unknown") {
      this.logger.warn(
        `Netopia IPN: unknown payment status code ${String(status)} for orderID=${orderID} — ignored`,
      );
      return { action: "not_supported" };
    }

    if (reason === "pending_3ds" || reason === "initiated") {
      // Deliberately still "not_supported" (no session transition), but now
      // distinguishable from a malformed/unknown code in the logs.
      this.logger.info(
        `Netopia IPN: orderID=${orderID} still ${reason} (code ${String(status)}) — no action`,
      );
      return { action: "not_supported" };
    }

    if (mapped === PS.authorized) {
      const check = await this.matchesSessionAmount(orderID, amount, currency);
      if (!check.ok && check.missing) {
        // Paid on a session Medusa has since hard-deleted: a later
        // "Plătește" click for the same cart replaced it, but the old
        // Netopia page stayed payable. There is no cart link left to
        // complete, so a human must refund (or place the order manually).
        this.logger.error(
          `Netopia IPN ORFAN — plată ${reason} pe o sesiune ștearsă ` +
            `(înlocuită de un click ulterior pe „Plătește”): orderID=${orderID} ` +
            `ntpID=${ipn?.payment?.ntpID ?? "-"} suma=${amount} ${currency || "?"} — ` +
            `nu există comandă; rambursează din panoul Netopia sau creează comanda manual`,
        );
        return { action: "not_supported" };
      }
      if (!check.ok) {
        // An IPN claiming success for a different amount/currency than the one
        // we asked Netopia to charge must never authorize the session.
        this.logger.error(
          `Netopia IPN amount/currency mismatch for orderID=${orderID}: ` +
            `IPN=${amount} ${currency || "?"} vs session=${check.expectedAmount ?? "?"} ` +
            `${check.expectedCurrency ?? "?"} — refusing to authorize`,
        );
        return { action: "not_supported" };
      }
      return { action: "authorized", data: { session_id: orderID, amount } };
    }

    if (mapped === PS.error) {
      return { action: "failed", data: { session_id: orderID, amount } };
    }

    return { action: "not_supported" };
  }

  /**
   * Compares the IPN's amount/currency against the values stored on the payment
   * session at initiatePayment time (data.amountRON / data.currency).
   *
   * If the payment module cannot be resolved from the provider container we
   * cannot compare, so we log and allow — the session is still independently
   * re-verified server-to-server by authorizePaymentSessionStep -> getPaymentStatus.
   */
  private async matchesSessionAmount(
    sessionId: string,
    ipnAmount: number,
    ipnCurrency: string,
  ): Promise<{
    ok: boolean;
    missing?: boolean;
    expectedAmount?: number;
    expectedCurrency?: string;
  }> {
    if (!sessionId) return { ok: false };

    // Resolution is attempted separately from the query: an Awilix cradle throws
    // on unregistered names, and "cannot look it up" must not become "reject the
    // payment" — only a failed lookup of an existing session does.
    let paymentModule:
      | { retrievePaymentSession?: (id: string) => Promise<any> }
      | undefined;
    try {
      // Registration name differs by Medusa version/loading path; probe both.
      paymentModule =
        (this.deps["paymentModuleService"] as typeof paymentModule) ??
        (this.deps[Modules.PAYMENT] as typeof paymentModule);
    } catch {
      paymentModule = undefined;
    }

    if (!paymentModule?.retrievePaymentSession) {
      this.logger.warn(
        "Netopia IPN: payment module unavailable in provider container — " +
          "amount/currency cross-check skipped (status still re-verified via getPaymentStatus)",
      );
      return { ok: true };
    }

    let session: any;
    try {
      session = await paymentModule.retrievePaymentSession(sessionId);
    } catch (err) {
      this.logger.warn(
        `Netopia IPN: could not load payment session ${sessionId} for amount check ` +
          `(${(err as Error).message}) — refusing to authorize on unverifiable data`,
      );
      const notFound = /not found/i.test((err as Error).message);
      return { ok: false, missing: notFound };
    }

    const stored = (session?.data ?? {}) as Record<string, unknown>;
    const expectedAmount =
      stored.amountRON !== undefined ? toNumber(stored.amountRON) : undefined;
    const expectedCurrency = (stored.currency as string | undefined)?.toUpperCase();

    if (expectedAmount === undefined || Number.isNaN(expectedAmount)) {
      this.logger.warn(
        `Netopia IPN: session ${sessionId} has no stored amountRON — amount check skipped`,
      );
      return { ok: true, expectedCurrency };
    }

    // Netopia reports RON with 2 decimals; tolerate float representation only.
    const amountOk = Math.abs(expectedAmount - ipnAmount) < 0.01;
    const currencyOk =
      !ipnCurrency || !expectedCurrency || ipnCurrency === expectedCurrency;

    return {
      ok: amountOk && currencyOk,
      expectedAmount,
      expectedCurrency,
    };
  }

  // `ctx` (PaymentProviderContext) nu conține billing_address în Medusa —
  // doar customer/account_holder/idempotency_key. Adresa reală de checkout
  // vine prin `dataAddr`, trimisă explicit de storefront în `data.billing_address`.
  private extractBilling(
    ctx: Record<string, unknown>,
    dataAddr?: Record<string, unknown>,
  ) {
    const customer = (ctx?.customer ?? {}) as Record<string, unknown>;
    const addr =
      dataAddr ?? ((ctx?.billing_address ?? {}) as Record<string, unknown>);

    return {
      email: (addr.email ?? customer.email ?? "client@example.com") as string,
      // Netopia acceptă doar format internațional — un „(0745)052200" scris
      // de client era respins cu „Numărul de telefon nu este valid".
      phone:
        toE164RoPhone((addr.phone ?? customer.phone) as string | undefined) ??
        "+40700000000",
      firstName: (addr.first_name ?? customer.first_name ?? "Client") as string,
      lastName: (addr.last_name ?? customer.last_name ?? "") as string,
      city: (addr.city ?? "Bucuresti") as string,
      country: 642,
      countryName: "Romania",
      details: "",
      postalCode: (addr.postal_code ?? "") as string,
      state: (addr.province ?? "") as string,
    };
  }
}

export default NetopiaProviderService;
