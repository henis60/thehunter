"use client"

import { useReloadOnStaleDeployment } from "@lib/util/stale-deployment"
import ErrorContent from "@modules/common/components/error-content"
import { isConnectionError } from "@lib/util/is-connection-error"
import { useTranslations } from "next-intl"

// Error boundary pentru rutele de checkout (inclusiv return-ul Netopia).
// Fără acest boundary, orice eroare client necaptată (ex. o cursă între
// redirect-ul extern și un refresh RSC pe mobil) golea complet aplicația cu
// pagina generică "a client-side exception has occurred". Aici o transformăm
// într-o stare recuperabilă — plata în sine e procesată server-to-server (IPN).
export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useReloadOnStaleDeployment(error)
  const t = useTranslations("checkout")

  if (isConnectionError(error)) {
    return (
      <ErrorContent
        reset={reset}
        title={t("Magazin temporar indisponibil")}
        description={t("Nu am putut contacta serverul chiar acum Dacă ai finalizat deja plata, comanda ta este în siguranță Te rugăm să revii peste câteva minute")}
        homeHref="/cos"
        homeLabel={t("Înapoi la coș")}
      />
    )
  }

  return (
    <ErrorContent
      reset={reset}
      description={t("Nu-ți face griji - dacă ai finalizat plata, comanda ta este în siguranță și vei primi un email de confirmare Poți reîncerca sau reveni la coș")}
      homeHref="/cos"
      homeLabel={t("Înapoi la coș")}
    />
  )
}
