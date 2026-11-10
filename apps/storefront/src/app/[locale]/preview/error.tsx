"use client"

import { useReloadOnStaleDeployment } from "@lib/util/stale-deployment"
import ErrorContent from "@modules/common/components/error-content"
import { isConnectionError } from "@lib/util/is-connection-error"

// Error boundary pentru grupul preview — vezi (main)/error.tsx pentru context.
export default function PreviewError({
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
