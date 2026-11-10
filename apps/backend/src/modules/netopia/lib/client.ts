import {
  NetopiaOperationRequest,
  NetopiaOperationResponse,
  NetopiaOptions,
  NetopiaStartRequest,
  NetopiaStartResponse,
} from "./types";

const SANDBOX_BASE = "https://secure.sandbox.netopia-payments.com";
const LIVE_BASE = "https://secure.mobilpay.ro/pay";

/** Arată doar cât să recunoști valoarea, niciodată destul cât s-o folosești. */
function mask(value: string): string {
  if (!value) return "(lipsă)";
  return value.length <= 8
    ? `${value.slice(0, 2)}…(${value.length})`
    : `${value.slice(0, 4)}…${value.slice(-2)} (${value.length})`;
}

/** Loguri minimale injectate din service (care deține logger-ul Medusa). */
export type NetopiaClientLogger = {
  info: (msg: string) => void;
  error: (msg: string) => void;
};

export class NetopiaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly posSignature: string;
  private readonly log?: NetopiaClientLogger;

  constructor(options: NetopiaOptions, log?: NetopiaClientLogger) {
    this.baseUrl = options.sandbox ? SANDBOX_BASE : LIVE_BASE;
    this.apiKey = options.apiKey;
    this.posSignature = options.posSignature;
    this.log = log;

    // Prima linie de diagnostic la live: confirmă CĂTRE CINE plecăm și cu ce
    // credențiale, fără să scurgem cheile în loguri.
    this.log?.info(
      `Netopia client: baseUrl=${this.baseUrl} sandbox=${options.sandbox} ` +
        `posSignature=${mask(this.posSignature)} apiKey=${mask(this.apiKey)}`,
    );
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const startedAt = Date.now();
    this.log?.info(`Netopia → POST ${this.baseUrl}${path}`);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Eșec de transport (DNS, TLS, timeout) — altfel invizibil în loguri.
      this.log?.error(
        `Netopia ✗ ${path} transport error după ${Date.now() - startedAt}ms: ` +
          `${(err as Error).name}: ${(err as Error).message}`,
      );
      throw err;
    }

    const ms = Date.now() - startedAt;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.log?.error(
        `Netopia ✗ ${path} HTTP ${res.status} după ${ms}ms: ${text.slice(0, 300)}`,
      );
      throw new Error(
        `Netopia ${path} failed [${res.status}]: ${text.slice(0, 300)}`,
      );
    }

    const json = (await res.json()) as T;
    const p = (json as any)?.payment;
    const e = (json as any)?.error;

    // Doar câmpuri neutre: fără date de card, fără billing.
    this.log?.info(
      `Netopia ← ${path} HTTP ${res.status} în ${ms}ms ` +
        `ntpID=${p?.ntpID ?? "-"} status=${p?.status ?? "-"} ` +
        `errorCode=${e?.code ?? "-"}${e?.message ? ` errorMessage=${e.message}` : ""}`,
    );

    return json;
  }

  async startPayment(req: NetopiaStartRequest): Promise<NetopiaStartResponse> {
    return this.request<NetopiaStartResponse>("/payment/card/start", req);
  }

  async getStatus(ntpID: string): Promise<NetopiaOperationResponse> {
    const body: NetopiaOperationRequest = {
      ntpID,
      posSignature: this.posSignature,
    };
    return this.request<NetopiaOperationResponse>("/operation/status", body);
  }

  async capture(
    ntpID: string,
    amount: number,
    currency = "RON",
  ): Promise<NetopiaOperationResponse> {
    const body: NetopiaOperationRequest = {
      ntpID,
      posSignature: this.posSignature,
      amount,
      currency,
    };
    return this.request<NetopiaOperationResponse>("/operation/capture", body);
  }

  async void(ntpID: string): Promise<NetopiaOperationResponse> {
    const body: NetopiaOperationRequest = {
      ntpID,
      posSignature: this.posSignature,
    };
    return this.request<NetopiaOperationResponse>("/operation/void", body);
  }

  /**
   * Refund (credit). Per the v2 OpenAPI spec (secure.sandbox.netopia-payments.com/spec),
   * `OperationRequest` is flat `{ ntpID, amount }` only: no posSignature and no
   * currency. Sending those extra fields got a 400 "general error" back.
   */
  async refund(ntpID: string, amount: number): Promise<NetopiaOperationResponse> {
    const body = {
      ntpID,
      amount: Math.round(amount * 100) / 100,
    };
    const res = await this.request<NetopiaOperationResponse>("/operation/credit", body);
    // Netopia can answer 200 with an error object; that is not a refund.
    const code = res?.error?.code;
    if (code && code !== "00" && code !== "0" && !res?.payment) {
      throw new Error(
        `Netopia /operation/credit refused [${code}]: ${res.error?.message ?? "-"}`,
      );
    }
    return res;
  }
}
