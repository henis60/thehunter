"use client"

import { useEffect } from "react"

/**
 * The cart drawer lives in the persistent layout — it never remounts on
 * navigation, so a tab left open across a deploy keeps calling Server
 * Actions by an id baked into the old JS bundle. The new deployment doesn't
 * recognize that id, so Next.js's client runtime rejects with an error like
 * "Failed to find Server Action ... This request might be from an older or
 * newer deployment." Any component that stays mounted across navigations
 * (drawer, header, persistent widgets) can hit this after a deploy while the
 * /cart *page* doesn't, because navigating there re-fetches the RSC tree
 * (and its current action ids) fresh every time.
 *
 * There's nothing meaningful to recover locally once this happens — every
 * further action call from this tab will fail the same way — so the fix is
 * a full reload to pick up the new deployment's JS.
 */
export function isStaleDeploymentError(err: unknown): boolean {
  // Next/webpack throws a real ChunkLoadError (with this exact `name`) when
  // a lazy-loaded chunk 404s — the far more common way a stale tab notices
  // a new deploy than the server-action case below, since it can be
  // triggered by any dynamic import(), not just a mounted component calling
  // a now-unrecognized action id.
  if (err && typeof err === "object" && (err as any).name === "ChunkLoadError") {
    return true
  }
  const message = err instanceof Error ? err.message : String(err ?? "")
  return (
    /failed to find server action/i.test(message) ||
    // Next 15+ wording: 'Server Action "<id>" was not found on the server.'
    /server action.*not found/i.test(message) ||
    /failed-to-find-server-action/i.test(message) ||
    // Thrown by Next's action client when, mid-deploy, the server answers an
    // action POST with an HTML page (or nothing) instead of an RSC payload.
    /unexpected response was received from the server/i.test(message) ||
    /older or newer deployment/i.test(message) ||
    /loading chunk [\w.-]+ failed/i.test(message) ||
    /chunkloaderror/i.test(message) ||
    // Thrown by webpack's own require runtime when an RSC prefetch (e.g. a
    // <Link> entering the viewport) resolves a module id that no longer
    // exists in the currently-loaded bundle — same stale-tab-after-deploy
    // root cause as the cases above, just surfacing as a raw TypeError
    // instead of a named Next.js error.
    /cannot read properties of undefined \(reading 'call'\)/i.test(message)
  )
}

// Guards against a reload loop: if the deploy itself is somehow broken (not
// just this tab being stale), reloading wouldn't fix anything and would just
// hammer the user's browser forever. One reload per *stale bundle* is enough
// to recover from the normal stale-chunk case — see clearStaleDeployReloadGuard
// for why this key must not simply persist for the tab's entire lifetime.
const RELOAD_GUARD_KEY = "hunter_stale_deploy_reload"

export function reloadForNewDeployment() {
  if (typeof window === "undefined") return
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
  } catch {}
  window.location.reload()
}

/**
 * Call once a page has freshly mounted (see ChunkErrorGuard) to release the
 * reload guard above. Without this, the guard — set once and never
 * cleared — permanently disabled recovery for the rest of that browser
 * tab's lifetime: a customer who hit one stale-chunk error, got auto-
 * reloaded, and then (in a long-lived tab, across a *second* later deploy)
 * hit another one would just see the raw error with no recovery, silently,
 * forever. A fresh mount means whatever JS is now running just loaded
 * successfully, so any stale-deployment error from this point on is a new,
 * genuine incident that deserves its own reload.
 */
export function clearStaleDeployReloadGuard() {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
  } catch {}
}

/**
 * Turns a caught error into text safe to show a customer. Framework/network
 * internals (a stale server action id, a failed chunk load, "Failed to
 * fetch") must never reach the screen verbatim — a raw "Server Action ...
 * was not found" with a link to Next's docs means nothing to a shopper mid
 * checkout. Genuine backend validation messages (Medusa's own "Adresa de
 * livrare este necesară" etc.) are left as-is; they're meant to be read.
 *
 * For the stale-deployment case specifically, this also triggers the reload
 * that recovers from it — the caller only needs a string to show for the
 * brief moment before that reload lands.
 */
export function getDisplayableErrorMessage(
  err: unknown,
  fallback: string
): string {
  if (isStaleDeploymentError(err)) {
    reloadForNewDeployment()
    return fallback
  }
  const message = err instanceof Error ? err.message : ""
  if (!message || isFrameworkInternalMessage(message)) return fallback
  return message
}

/**
 * Messages that come from the browser/Next.js runtime rather than from our
 * backend — never meaningful to a customer, so they get the generic
 * fallback instead of being shown verbatim.
 */
function isFrameworkInternalMessage(message: string): boolean {
  return (
    /nextjs\.org\/docs/i.test(message) ||
    /server action/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /^load failed$/i.test(message.trim()) ||
    /network request failed/i.test(message) ||
    /unexpected token .* json/i.test(message) ||
    /cannot read propert/i.test(message) ||
    /is not a function/i.test(message) ||
    /is not defined/i.test(message)
  )
}

/**
 * For error boundaries (error.tsx / global-error.tsx): a stale server action
 * called through useActionState/startTransition throws during render and
 * lands in the nearest boundary rather than in a try/catch or on `window`,
 * so ChunkErrorGuard never sees it. Reload to pick up the new deployment
 * instead of leaving the customer on an error screen.
 */
export function useReloadOnStaleDeployment(error: unknown) {
  useEffect(() => {
    if (isStaleDeploymentError(error)) reloadForNewDeployment()
  }, [error])
}
