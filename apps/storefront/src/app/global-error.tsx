"use client"

import { useReloadOnStaleDeployment } from "@lib/util/stale-deployment"

// Plasă de siguranță finală: prinde erori aruncate chiar din RootLayout
// (providers, fonturi etc.), unde error.tsx-urile din grupurile de rute nu
// ajung să se monteze. Next.js cere ca acest fișier să randeze propriile
// <html>/<body> — nu ne putem baza pe CSS vars din ThemeProvider, deci
// culorile sunt hardcodate.

// Stil comun pentru butonul și linkul de jos. Un <button> și un <a> au valori
// implicite diferite (font, bordură, înălțime de rând), de aceea sunt toate
// fixate explicit — altfel unul ieșea mai mic decât celălalt. Bordura e pe
// ambele, cu aceeași grosime, chiar dacă la buton are culoarea fundalului.
const buttonBase: React.CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "48px",
  padding: "0.75rem 1.5rem",
  border: "1px solid #c9a84c",
  fontFamily: "inherit",
  fontSize: "12px",
  lineHeight: 1.2,
  textTransform: "uppercase",
  letterSpacing: "4px",
  whiteSpace: "nowrap",
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useReloadOnStaleDeployment(error)
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0D0D0D" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ color: "#F5F1E8", fontSize: "1.75rem", margin: 0 }}>
            A apărut o eroare
          </h1>
          <p style={{ color: "#A39C8E", fontSize: "0.85rem", maxWidth: "22rem", margin: 0 }}>
            Ceva nu a funcționat cum trebuie. Poți reîncerca sau reveni la
            pagina principală.
          </p>
          {/* Grilă cu două coloane egale: ambele butoane iau lățimea celui mai
              lung text, deci arată identic. Cu `flex`, lățimea venea din text
              („Reîncearcă" ieșea mult mai îngust decât „Pagina principală"). */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
            <button
              onClick={() => {
                // reset() alone just re-renders the segment without
                // refetching whatever crashed (a stale cache entry, a
                // module that failed to load, a broken font/provider at
                // RootLayout level) — it often no-ops, leaving the same
                // error on screen and making the button look broken. A
                // hard reload guarantees the recovery reset() is supposed
                // to provide (same fix already applied to the nested
                // error.tsx boundaries' ErrorContent component).
                reset()
                window.location.reload()
              }}
              style={{
                ...buttonBase,
                background: "#c9a84c",
                color: "#0D0D0D",
                cursor: "pointer",
              }}
            >
              Reîncearcă
            </button>
            <a
              href="/"
              style={{
                ...buttonBase,
                background: "transparent",
                color: "#c9a84c",
                textDecoration: "none",
              }}
            >
              Pagina principală
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
