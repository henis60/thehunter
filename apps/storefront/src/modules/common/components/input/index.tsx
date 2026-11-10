import { useTranslations } from "next-intl"
import React, { useEffect, useImperativeHandle, useState } from "react"

import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"

type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
}

// Mobile keyboards show a "next" arrow (via enterKeyHint="next") but tapping
// it still fires a plain Enter keypress, which browsers treat as implicit
// form submission — the visual hint alone doesn't change that behavior. This
// moves focus to the next field instead, so "next" actually advances rather
// than submitting the whole form.
function focusNextField(current: HTMLInputElement) {
  const form = current.form
  if (!form) return

  const fields = Array.from(
    form.querySelectorAll<HTMLElement>("input, select, textarea, button")
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)

  const index = fields.indexOf(current)
  if (index === -1 || index === fields.length - 1) return

  fields[index + 1].focus()
}

// Localized validation messages derived from the browser's ValidityState, so we
// can replace the generic native bubble with a styled inline message.
function getValidationMessage(
  el: HTMLInputElement,
  t: ReturnType<typeof useTranslations>
): string {
  const v = el.validity
  if (v.valueMissing) return t("Acest câmp este obligatoriu")
  if (v.typeMismatch) {
    if (el.type === "email") return t("Introdu o adresă de email validă")
    if (el.type === "url") return t("Introdu un link valid")
    return t("Valoare invalidă")
  }
  // `title` is where callers put a field-specific hint for a `pattern`
  // (e.g. phone format) — falling back to the generic message here would
  // silently discard it, since the browser's own bubble is suppressed.
  if (v.patternMismatch) return el.title || t("Formatul nu este valid")
  if (v.tooShort) return t("Minim {min} caractere", { min: el.minLength })
  if (v.tooLong) return t("Maxim {max} caractere", { max: el.maxLength })
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch)
    return t("Valoare invalidă")
  return el.validationMessage || t("Valoare invalidă")
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type,
      name,
      label,
      touched: _touched,
      errors: _errors,
      required,
      topLabel,
      className,
      onChange,
      onInvalid,
      onKeyDown,
      enterKeyHint,
      ...props
    },
    ref
  ) => {
    const t = useTranslations("common")
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      if (type === "password") {
        setInputType(showPassword ? "text" : "password")
      }
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
      // Suppress the native validation bubble and show our own message instead.
      e.preventDefault()
      setError(getValidationMessage(e.currentTarget, t))
      onInvalid?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (error) setError(null)
      onChange?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && enterKeyHint === "next") {
        e.preventDefault()
        focusNextField(e.currentTarget)
      }
      onKeyDown?.(e)
    }

    return (
      <div className="flex flex-col w-full gap-1">
        {(topLabel || label) && (
          <label
            htmlFor={name}
            className="font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)]"
          >
            {topLabel || label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative w-full">
          <input
            id={name}
            type={inputType}
            name={name}
            required={required}
            enterKeyHint={enterKeyHint}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInvalid={handleInvalid}
            aria-invalid={error ? true : undefined}
            className={`w-full h-10 px-3 bg-transparent border text-[var(--theme-text)] font-sans text-base placeholder:text-[var(--theme-text-muted)] placeholder:text-[16px] focus:outline-none transition-colors ${
              error
                ? "border-rose-500 focus:border-rose-500"
                : "border-[var(--theme-border)] focus:border-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)]"
            } ${type === "password" ? "pr-10" : ""} ${className ?? ""}`}
            {...props}
            ref={inputRef}
          />
          {type === "password" && (
            <button
              type="button"
              // Without this, a mousedown on this button (which sits right
              // next to the input) can blur the input first, racing with
              // the click that follows — the toggle then only reliably
              // fires while the input already has focus. Preventing the
              // default here stops that focus change entirely, so the
              // click always registers regardless of prior focus state.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
        {error && (
          <span className="font-sans text-[12px] text-rose-500" role="alert">
            {error}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input
