import { ChevronUpDown } from "@medusajs/icons"
import { useTranslations } from "next-intl"
import {
  SelectHTMLAttributes,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

export type NativeSelectProps = {
  placeholder?: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  label?: string
} & SelectHTMLAttributes<HTMLSelectElement>

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      placeholder,
      defaultValue,
      value,
      className,
      children,
      label,
      required,
      onChange,
      onInvalid,
      ...props
    },
    ref
  ) => {
    const t = useTranslations("common")
    const resolvedPlaceholder = placeholder ?? t("Selectează")
    const innerRef = useRef<HTMLSelectElement>(null)
    const [error, setError] = useState<string | null>(null)

    useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
      ref,
      () => innerRef.current
    )

    const handleInvalid = (e: React.FormEvent<HTMLSelectElement>) => {
      e.preventDefault()
      setError(t("Acest câmp este obligatoriu"))
      onInvalid?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (error) setError(null)
      onChange?.(e)
    }

    return (
      <div className="flex flex-col w-full gap-1">
        {(label || resolvedPlaceholder) && (
          <label className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
            {label || resolvedPlaceholder}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative w-full">
          <select
            ref={innerRef}
            {...(value !== undefined
              ? { value }
              : { defaultValue: defaultValue ?? "" })}
            required={required}
            onChange={handleChange}
            onInvalid={handleInvalid}
            aria-invalid={error ? true : undefined}
            {...props}
            className={`appearance-none w-full h-10 px-3 pr-8 bg-transparent border text-[var(--theme-text)] font-sans text-[13px] focus:outline-none transition-colors ${
              error
                ? "border-rose-500 focus:border-rose-500"
                : "border-[var(--theme-border)] focus:border-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)]"
            } ${className ?? ""}`}
          >
            <option disabled value="">
              {resolvedPlaceholder}
            </option>
            {children}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--theme-text-muted)]">
            <ChevronUpDown />
          </span>
        </div>
        {error && (
          <span className="font-sans text-[11px] text-rose-500" role="alert">
            {error}
          </span>
        )}
      </div>
    )
  }
)

NativeSelect.displayName = "NativeSelect"

export default NativeSelect
