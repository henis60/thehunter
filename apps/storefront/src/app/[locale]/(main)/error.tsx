"use client"

import { useReloadOnStaleDeployment } from "@lib/util/stale-deployment"
import ErrorContent from "@modules/common/components/error-content"
import { isConnectionError } from "@lib/util/is-connection-error"

// Error boundary pentru rutele din grupul (main). Fără acest boundary, orice
// eroare client necaptată golea complet aplicația cu pagina generică
// "a client-side exception has occurred" — vezi (checkout)/error.tsx pentru
// precedentul care a rezolvat aceeași problemă pe fluxul de plată.
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useReloadOnStaleDeployment(error)
  if (isConnectionError(error)) {
    return (
      <ErrorContent
        reset={reset}
        title="Magazin temporar indisponibil"
        description="Nu am putut contacta serverul chiar acum. Te rugăm să revii peste câteva minute."
      />
    )
  }

  return <ErrorContent reset={reset} />
}
