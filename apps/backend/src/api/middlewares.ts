import {
  authenticate,
  defineMiddlewares,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { timingSafeEqual } from "crypto";
import multer from "multer";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";

// Uploads are buffered in memory and then base64-encoded (which inflates them
// by ~33%) before being handed to the workflow, so an unbounded upload is an
// OOM waiting to happen — these caps are what keep a large batch from taking
// the whole backend process down.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_UPLOAD_FILES = 20;

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
});

// multer signals limit breaches as errors on the middleware, which would
// otherwise surface as an opaque 500. Translate them into the { message }
// shape the media-library UI already renders.
const mediaUploadWithLimits = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (err?: unknown) => void
) => {
  mediaUpload.array("files")(req as any, res as any, (err: any) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: `Fișier prea mare. Limita este de ${
          MAX_UPLOAD_BYTES / (1024 * 1024)
        } MB per fișier.`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({
        message: `Prea multe fișiere. Maximum ${MAX_UPLOAD_FILES} per încărcare.`,
      });
    }
    return res.status(400).json({ message: "Încărcare invalidă." });
  });
};

// admin.thehunter.ro must never be indexed. Its own robots.txt route says so,
// but Cloudflare's edge-managed robots.txt for this zone overrides/replaces
// it (confirmed: the live response has no `Disallow: /` for this host) — a
// response header isn't subject to that override, so it's the reliable
// signal. Applies to every response from this backend, admin dashboard and
// storefront-facing /store, /auth, /hooks APIs alike; none of it should ever
// show up in search results.
const noIndexHeader = (
  _req: MedusaRequest,
  res: MedusaResponse,
  next: () => void
) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
};

// Same signal as medusa-config.ts's redisModules: with REDIS_URL set
// (staging/production), counters live in Redis and are shared across
// instances; without it (local dev), express-rate-limit falls back to its
// in-memory default — a single process has no one to share state with
// anyway.
const redisUrl = process.env.REDIS_URL;
const redisClient = redisUrl ? new Redis(redisUrl) : null;
// ioredis emits "error" on every connection hiccup (not just the initial
// connect) — with no listener, Node treats an unhandled EventEmitter "error"
// as an uncaught exception and crashes the whole process, taking every
// unrelated route down with it, not just the rate-limited ones. Logging is
// enough here; `passOnStoreError` below (not this listener) is what keeps
// individual requests working while Redis is unreachable.
redisClient?.on("error", (err) => {
  console.error("[rate-limit] Redis connection error:", err.message);
});

const redisStore = (prefix: string) =>
  redisClient
    ? new RedisStore({
        prefix,
        sendCommand: (...args: string[]) =>
          redisClient.call(
            ...(args as [string, ...string[]])
          ) as ReturnType<RedisStore["sendCommand"]>,
      })
    : undefined;

// The /store/eawb/* routes take a cart_id and return that cart's shipping
// address (geocoded coordinates, locality, courier quotes). They can't require
// customer auth — guest checkout uses them too, and a guest has no session —
// but they are only ever called by the storefront's server actions
// (lib/data/fulfillment.ts), never by the browser directly. A shared secret
// therefore closes them to the public internet without touching the guest flow.
//
// Enforced only when EAWB_INTERNAL_SECRET is configured, so deploying this
// ahead of the env var can't break checkout. Set it on BOTH the backend and the
// storefront to activate.
const eawbInternalSecret = process.env.EAWB_INTERNAL_SECRET;

if (!eawbInternalSecret) {
  console.warn(
    "[eawb] EAWB_INTERNAL_SECRET is not set — /store/eawb/* is reachable by " +
      "anyone who knows a cart id. Set it on the backend and the storefront to " +
      "restrict these routes to the storefront server."
  );
}

const requireInternalSecret = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: () => void
) => {
  if (!eawbInternalSecret) return next();

  const provided = req.headers["x-internal-secret"];

  // Compare BYTE lengths, not string lengths: timingSafeEqual throws a
  // RangeError on differing byte lengths, and a multi-byte secret can have
  // equal string length but different byte length — which would turn a wrong
  // guess into an unauthenticated 500 instead of a clean 401.
  const providedBuf =
    typeof provided === "string" ? Buffer.from(provided) : null;
  const expectedBuf = Buffer.from(eawbInternalSecret);

  const valid =
    providedBuf !== null &&
    providedBuf.length === expectedBuf.length &&
    timingSafeEqual(providedBuf, expectedBuf);

  if (!valid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

// Shared 429 shape: matches the { error: string } responses these routes
// already return on validation failure, so the storefront's existing
// `res.status === 429` handling (contact/newsletter/appointment forms,
// login/signup/reset-password) needs no changes to pick this up.
const rateLimited = (message: string) =>
  (_req: MedusaRequest, res: MedusaResponse) => {
    res.status(429).json({ error: message });
  };

// Public, unauthenticated, reCAPTCHA-gated form endpoints — keyed by IP,
// generous enough for a real user retrying a typo but tight enough to blunt
// scripted abuse that gets past reCAPTCHA.
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // If Redis is unreachable, let the request through rather than block it —
  // degraded rate limiting beats a hard failure on every contact/newsletter
  // submission, login, or AI generation.
  passOnStoreError: true,
  store: redisStore("rl:form:"),
  handler: rateLimited("Prea multe încercări. Te rugăm să revii peste câteva minute."),
});

// Newsletter needs its own limiter because, unlike the contact form, its
// authenticated calls arrive from the storefront's SERVER (they're server
// actions — the JWT lives in an httpOnly cookie the browser can't read). Every
// logged-in customer therefore shares the storefront's single IP, so a plain
// per-IP limit would put the whole site in one bucket: the account page fires a
// no-store subscription lookup on every render, which would 429 for everyone
// after a handful of page views.
//
// Skipping authenticated callers keeps the per-IP budget where it's meaningful
// — the anonymous, browser-submitted signup form — while a logged-in customer
// is rate-limited by having an account at all. `authenticate` must run BEFORE
// this in the chain for `auth_context` to be populated here.
const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore("rl:newsletter:"),
  skip: (req) =>
    Boolean((req as unknown as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id),
  handler: rateLimited("Prea multe încercări. Te rugăm să revii peste câteva minute."),
});

// Auth endpoints double as the brute-force surface — same window, same
// per-IP key, kept separate from the form limiter so a contact-form burst
// can't lock a customer out of login (or vice versa).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore("rl:auth:"),
  // Same trap documented on newsletterLimiter and netopiaSessionCartLimiter:
  // the storefront calls /auth/customer/* from a server action, so req.ip is
  // that container's address for EVERY visitor — a plain per-IP key made this
  // one 10-per-15-minutes budget shared by the whole site, locking out the
  // eleventh person to log in. The storefront forwards the visitor's real
  // address as x-client-ip (see its lib/config.ts getClientScopedSdk).
  //
  // Trusting a caller-supplied header is only safe because nothing else can
  // reach these routes: Cloudflare Access blocks /auth/* at the edge, so the
  // storefront over Railway's private network is the only origin. If that ever
  // changes, this header becomes spoofable for an unlimited budget and must be
  // replaced with a verified hop.
  keyGenerator: (req) => {
    const forwarded = (req.headers["x-client-ip"] as string | undefined)?.trim();
    return `ip:${ipKeyGenerator(forwarded || req.ip || "")}`;
  },
  handler: rateLimited("Prea multe încercări. Te rugăm să revii peste câteva minute."),
});

// Admin-gated but Anthropic-metered: caps spend/abuse per admin USER rather
// than guarding against anonymous traffic. Keyed on the authenticated actor id,
// not the IP — several admins in one office (or behind one VPN egress) share a
// single IP and would otherwise share one 20/hour budget between them.
const aiGenerateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore("rl:ai:"),
  // Falls back to IP only if auth_context is somehow missing (the route is
  // behind admin auth, so in practice it never is). ipKeyGenerator normalises
  // IPv6 to its /56 subnet — express-rate-limit rejects a raw req.ip key.
  keyGenerator: (req) => {
    const actorId = (req as unknown as {
      auth_context?: { actor_id?: string }
    }).auth_context?.actor_id
    return actorId ? `user:${actorId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`
  },
  handler: rateLimited("Prea multe cereri către AI. Te rugăm să revii peste câteva minute."),
});

// /store/netopia/session-cart is polled by the return page while a payment
// settles (every 2.5s, up to 20 times — see the storefront's return-client.tsx).
// It cannot require auth: a guest comes back from Netopia with no session.
//
// Keyed on the payment session id, NOT the IP. The poll is a server action
// (lib/data/cart.ts → completeNetopiaBySession), so every customer's polling
// arrives from the storefront server's single IP — exactly the trap documented
// on newsletterLimiter above; a per-IP budget would be consumed by whoever
// checked out first and would leave everyone else unable to complete an order.
// A session id belongs to one checkout, so it is the natural per-customer key.
//
// 60 = three full 20-poll runs for the same session (reloads, back button),
// well above one legitimate return flow but far below anything worth using to
// enumerate sessions.
const netopiaSessionCartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore("rl:netopia-session:"),
  keyGenerator: (req) => {
    const sessionId = req.query?.session_id;
    return typeof sessionId === "string" && sessionId
      ? `session:${sessionId}`
      : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  handler: rateLimited("Prea multe cereri. Te rugăm să reîncarci pagina peste câteva momente."),
});

// The Netopia IPN webhook is unauthenticated (signature verification can't be
// fully enforced yet) and each call triggers a workflow run plus an outbound
// status call to Netopia — so it needs a ceiling. But throttling it wrongly
// means an order silently never completes, which is worse than the abuse it
// prevents. Two consequences:
//
//  - NOT keyed by IP. Every IPN in existence arrives from Netopia's own small
//    set of IPs, so a per-IP limit would put all customers in one bucket and a
//    busy hour (or a retry storm after an outage) would drop real payments.
//    Keyed on the orderID in the body instead: one order's notifications are
//    the only thing that can exhaust one order's budget.
//  - Deliberately generous. Netopia retries an unacknowledged IPN, and a single
//    order legitimately produces a handful of notifications (authorized →
//    confirmed, plus retries). 30 per 15 minutes for ONE order is far more than
//    any real payment needs, while still capping forced workflow runs.
//
// Requests without a parseable orderID fall back to the IP bucket: those can't
// correspond to a real notification, so bucketing them together is the point.
// Medusa's json/text/urlencoded parsers only run when Content-Type matches.
// Netopia's "retrimite notificarea" (resend) from its admin panel posts the
// body with NO Content-Type at all, so no parser touched the stream, rawBody
// stayed undefined, and signature verification failed closed with
// "rawBody indisponibil" (the JWT `sub` is a hash of those exact bytes).
// This fallback reads the untouched stream for any content type. It is a
// no-op when a regular parser already consumed the body.
const IPN_MAX_BYTES = 256 * 1024;

function netopiaRawBodyFallback(
  req: MedusaRequest,
  res: MedusaResponse,
  next: (err?: unknown) => void,
) {
  const r = req as unknown as {
    rawBody?: Buffer;
    body?: unknown;
    _body?: boolean;
    readableEnded?: boolean;
    on: (ev: string, cb: (arg?: any) => void) => void;
  };
  if (r.rawBody || r._body || r.readableEnded) return next();

  const chunks: Buffer[] = [];
  let size = 0;
  let done = false;
  const finish = (err?: unknown) => {
    if (done) return;
    done = true;
    next(err);
  };

  r.on("data", (chunk: Buffer) => {
    if (done) return;
    size += chunk.length;
    if (size > IPN_MAX_BYTES) {
      done = true;
      res.status(413).json({ errorCode: 1, message: "Payload too large" });
      return;
    }
    chunks.push(chunk);
  });
  r.on("end", () => {
    if (done) return;
    const buf = Buffer.concat(chunks);
    r.rawBody = buf;
    r._body = true;
    try {
      r.body = buf.length ? JSON.parse(buf.toString("utf8")) : {};
    } catch {
      r.body = buf.toString("utf8");
    }
    finish();
  });
  r.on("error", (err) => finish(err));
}

const netopiaIpnLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore("rl:netopia-ipn:"),
  keyGenerator: (req) => {
    // The IPN is sent as text/plain and parsed by the route itself, so the body
    // here may still be a raw string — try both shapes rather than assuming.
    const body = (req as unknown as { body?: unknown }).body;
    let orderId: unknown;
    if (body && typeof body === "object") {
      orderId = (body as any).order?.orderID ?? (body as any).orderID;
    } else if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        orderId = parsed?.order?.orderID ?? parsed?.orderID;
      } catch {
        // Unparseable body — falls through to the IP bucket below.
      }
    }
    return typeof orderId === "string" && orderId
      ? `order:${orderId}`
      : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  // Netopia only treats a 200 as an acknowledgement; anything else is retried.
  // A 429 is therefore the correct signal here — it tells Netopia to come back
  // later rather than dropping the notification.
  handler: rateLimited("Prea multe notificări. Reîncearcă mai târziu."),
});

export default defineMiddlewares({
  routes: [
    {
      matcher: "*",
      middlewares: [noIndexHeader],
    },
    {
      // Netopia IPN: preserve raw body for JSON parsing (sent as text/plain)
      matcher: "/hooks/netopia",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
      // Same single-entry-per-matcher rule as /store/newsletter below: the
      // limiter goes here rather than in a second entry, so the bodyParser
      // config isn't split away from it.
      // Fallback first: the limiter keys on the orderID in the body.
      middlewares: [netopiaRawBodyFallback, netopiaIpnLimiter],
    },
    {
      matcher: "/store/netopia/session-cart",
      methods: ["GET"],
      middlewares: [netopiaSessionCartLimiter],
    },
    {
      matcher: "/store/orders/:id/invoice",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/admin/media-library",
      methods: ["POST"],
      middlewares: [mediaUploadWithLimits],
    },
    {
      matcher: "/store/contact",
      methods: ["POST"],
      middlewares: [publicFormLimiter],
    },
    {
      // NOTE: the key is `methods` (plural). `method` is deprecated and is
      // silently ignored by the middleware loader, which then registers the
      // handler with app.use() for EVERY verb — so a singular `method` here
      // would both widen the scope and, because this matcher is declared once,
      // run the limiter twice per request if it were split across entries.
      // Kept as a single entry per matcher for that reason.
      matcher: "/store/newsletter",
      methods: ["GET", "POST", "DELETE"],
      middlewares: [
        // Populates `req.auth_context` for a logged-in customer without
        // rejecting anonymous callers — the route decides what each may do.
        // Subscribing from the account page is authorised by that session;
        // anonymous subscribes still have to solve the reCAPTCHA.
        //
        // Must precede the limiter, which skips authenticated callers and so
        // needs `auth_context` already set.
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        newsletterLimiter,
      ],
    },
    // Medusa's emailpass provider registers these four routes directly
    // (see @medusajs/medusa/dist/api/auth/middlewares.js) — matched
    // explicitly rather than with a wildcard, since path-to-regexp doesn't
    // treat a trailing "*" as a sub-path wildcard the way it looks like it
    // would.
    {
      matcher: "/auth/customer/emailpass",
      methods: ["POST"],
      middlewares: [authLimiter],
    },
    {
      matcher: "/auth/customer/emailpass/register",
      methods: ["POST"],
      middlewares: [authLimiter],
    },
    {
      matcher: "/auth/customer/emailpass/reset-password",
      methods: ["POST"],
      middlewares: [authLimiter],
    },
    {
      matcher: "/auth/customer/emailpass/update",
      methods: ["POST"],
      middlewares: [authLimiter],
    },
    // Rate limit temporarily disabled — re-add `middlewares: [aiGenerateLimiter]`
    // to restore the 20/hour-per-admin cap once no longer needed.
    // {
    //   matcher: "/admin/ai/generate-product",
    //   methods: ["POST"],
    //   middlewares: [aiGenerateLimiter],
    // },
    // Matched individually rather than with "/store/eawb/*" — see the note on
    // the auth routes above about path-to-regexp not treating a trailing "*"
    // as a sub-path wildcard.
    {
      matcher: "/store/eawb/shipping-prices",
      methods: ["GET"],
      middlewares: [requireInternalSecret],
    },
    {
      matcher: "/store/eawb/lockers",
      methods: ["GET"],
      middlewares: [requireInternalSecret],
    },
    {
      matcher: "/store/eawb/geocode",
      methods: ["GET"],
      middlewares: [requireInternalSecret],
    },
  ],
});
