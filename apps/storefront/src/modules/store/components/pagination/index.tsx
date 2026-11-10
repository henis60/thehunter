"use client"

import { clx } from "@modules/common/components/ui"
import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@i18n/navigation"
import { useTranslations } from "next-intl"

export function Pagination({
  page,
  totalPages,
  'data-testid': dataTestid
}: {
  page: number
  totalPages: number
  'data-testid'?: string
}) {
  const t = useTranslations("store")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const arrayRange = (start: number, stop: number) =>
    Array.from({ length: stop - start + 1 }, (_, index) => start + index)

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const renderPageButton = (
    p: number,
    label: string | number,
    isCurrent: boolean
  ) => (
    <button
      key={p}
      aria-current={isCurrent ? "page" : undefined}
      className={clx(
        "font-sans text-[13px] tracking-[2px] tabular-nums pb-1 border-b transition-colors",
        isCurrent
          ? "text-[var(--theme-text)] border-hunter-gold"
          : "text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text)]"
      )}
      disabled={isCurrent}
      onClick={() => handlePageChange(p)}
    >
      {String(label).padStart(2, "0")}
    </button>
  )

  const renderEllipsis = (key: string) => (
    <span
      key={key}
      className="font-sans text-[13px] text-[var(--theme-text-muted)] select-none cursor-default pb-1"
    >
      —
    </span>
  )

  const renderPageButtons = () => {
    const buttons = []

    if (totalPages <= 7) {
      buttons.push(
        ...arrayRange(1, totalPages).map((p) =>
          renderPageButton(p, p, p === page)
        )
      )
    } else {
      if (page <= 4) {
        buttons.push(
          ...arrayRange(1, 5).map((p) => renderPageButton(p, p, p === page))
        )
        buttons.push(renderEllipsis("ellipsis1"))
        buttons.push(renderPageButton(totalPages, totalPages, totalPages === page))
      } else if (page >= totalPages - 3) {
        buttons.push(renderPageButton(1, 1, 1 === page))
        buttons.push(renderEllipsis("ellipsis2"))
        buttons.push(
          ...arrayRange(totalPages - 4, totalPages).map((p) =>
            renderPageButton(p, p, p === page)
          )
        )
      } else {
        buttons.push(renderPageButton(1, 1, 1 === page))
        buttons.push(renderEllipsis("ellipsis3"))
        buttons.push(
          ...arrayRange(page - 1, page + 1).map((p) =>
            renderPageButton(p, p, p === page)
          )
        )
        buttons.push(renderEllipsis("ellipsis4"))
        buttons.push(renderPageButton(totalPages, totalPages, totalPages === page))
      }
    }

    return buttons
  }

  const arrowClass = (disabled: boolean) =>
    clx(
      "inline-flex items-center gap-2 font-sans text-[12px] uppercase tracking-[3px] transition-colors",
      disabled
        ? "text-[var(--theme-border)] cursor-not-allowed"
        : "text-[var(--theme-text-muted)] hover:text-hunter-gold"
    )

  return (
    <nav
      className="flex items-center justify-between gap-6 w-full mt-16 pt-8 border-t border-[var(--theme-border)]"
      data-testid={dataTestid}
      aria-label={t("Paginare")}
    >
      <button
        onClick={() => handlePageChange(page - 1)}
        disabled={page <= 1}
        className={arrowClass(page <= 1)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 6 9 12 15 18" />
        </svg>
        <span className="hidden small:inline">{t("Anterior")}</span>
      </button>

      <div className="flex items-end gap-5">{renderPageButtons()}</div>

      <button
        onClick={() => handlePageChange(page + 1)}
        disabled={page >= totalPages}
        className={arrowClass(page >= totalPages)}
      >
        <span className="hidden small:inline">{t("Următor")}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
    </nav>
  )
}
