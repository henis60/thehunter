"use client"

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

type County = { id: number; name: string; code: string }
type Locality = { id: number; name: string }

// Case-, diacritics- and whitespace-insensitive comparison key.
const normalize = (s: string | null | undefined): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

// Module-level caches so the datasets are fetched at most once per session.
let countiesCache: County[] | null = null
const localitiesCache: Record<string, Locality[]> = {}

// Backed by static JSON assets under /public/ro-localities. Static files are
// served straight from the CDN with correct per-path caching — unlike a
// serverless route, whose query-string branch was being cached/optimized away
// on staging and returned no localities.
async function fetchCounties(): Promise<County[]> {
  if (countiesCache) return countiesCache
  const res = await fetch("/ro-localities/counties.json")
  const { counties } = await res.json()
  const list = Array.isArray(counties) ? counties : []
  countiesCache = list
  return list
}

async function fetchLocalities(countyId: number): Promise<Locality[]> {
  const key = String(countyId)
  if (localitiesCache[key]) return localitiesCache[key]
  const res = await fetch(`/ro-localities/${countyId}.json`)
  const { localities } = await res.json()
  const list = Array.isArray(localities) ? localities : []
  if (list.length) localitiesCache[key] = list
  return list
}

const fieldLabelCls =
  "font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)]"
const controlCls =
  "appearance-none w-full h-10 px-3 pr-8 bg-transparent border border-[var(--theme-border)] text-[var(--theme-text)] font-sans text-[14px] focus:outline-none focus:border-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
const optionsCls =
  "z-50 max-h-60 overflow-auto border border-[var(--theme-border)] bg-[var(--theme-bg,#0D0D0D)] shadow-lg focus:outline-none [--anchor-gap:4px]"
const optionCls =
  "cursor-pointer px-3 py-2 font-sans text-[14px] text-[var(--theme-text)] data-[focus]:bg-hunter-gold/10 data-[focus]:text-hunter-gold"

function ComboField<T extends { id: number; name: string }>({
  label,
  required,
  value,
  options,
  onSelect,
  disabled,
  placeholder,
  testId,
  fieldName,
  requiredMessage,
  noResultsLabel,
  typeToSearchLabel,
}: {
  label: string
  required?: boolean
  value: T | null
  options: T[]
  onSelect: (v: T | null) => void
  disabled?: boolean
  placeholder?: string
  testId?: string
  // Used for the input's `id` (and the label's `htmlFor`) — unlike `testId`,
  // this must be unique even when two LocalitySelect instances share a page
  // (e.g. shipping + billing address both rendered at once), so it's the
  // actual submitted field name, not the fixed test id.
  fieldName: string
  requiredMessage: string
  noResultsLabel: string
  typeToSearchLabel: string
}) {
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Constraint validation on a combobox normally only looks at whatever text
  // sits in the visible input — a user can type a name, never select an
  // option (leaving `value` null and the real hidden field empty), and still
  // pass `required` because the DOM input itself is non-empty. Driving
  // validity off `value` directly instead makes it reflect an actual
  // selection, not just typed text.
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? requiredMessage : "")
  }, [required, value, requiredMessage])

  const MAX_RESULTS = 50
  const list = options ?? []
  const matches = query
    ? list.filter((o) =>
        o.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : list
  // Render at most MAX_RESULTS — large counties have 600+ localities and
  // rendering them all makes the dropdown sluggish.
  const filtered = matches?.slice(0, MAX_RESULTS)
  const truncated = matches?.length > MAX_RESULTS

  const handleSelect = (v: T | null) => {
    if (error) setError(null)
    onSelect(v)
  }

  const inputId = `${fieldName}-field`

  return (
    <div className="flex flex-col w-full gap-1">
      <label className={fieldLabelCls} htmlFor={inputId}>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <Combobox
        value={value}
        onChange={handleSelect}
        disabled={disabled}
        immediate
        onClose={() => setQuery("")}
      >
        <div className="relative w-full">
          <ComboboxInput
            ref={inputRef}
            id={inputId}
            className={`${controlCls} ${
              error ? "border-rose-500 focus:border-rose-500" : ""
            }`}
            displayValue={(o: T | null) => o?.name ?? ""}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            data-testid={testId}
            autoComplete="off"
            required={required}
            aria-invalid={error ? true : undefined}
            onInvalid={(e) => {
              e.preventDefault()
              setError(requiredMessage)
            }}
          />
          <ComboboxButton className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]">
            <ChevronUpDown />
          </ComboboxButton>
          <ComboboxOptions
            anchor="bottom start"
            className={optionsCls}
            style={{ width: "var(--input-width)" }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 font-sans text-[14px] text-[var(--theme-text-muted)]">
                {noResultsLabel}
              </div>
            ) : (
              <div>
                {filtered.map((o) => (
                  <ComboboxOption key={o.id} value={o} className={optionCls}>
                    {o.name}
                  </ComboboxOption>
                ))}
                {truncated && (
                  <div className="px-3 py-2 font-sans text-[13px] text-[var(--theme-text-muted)]">
                    {typeToSearchLabel}
                  </div>
                )}
              </div>
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
      {error && (
        <span className="font-sans text-[12px] text-rose-500" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export type LocalitySelectProps = {
  countyFieldName: string
  cityFieldName: string
  countyValue?: string
  cityValue?: string
  onChange?: (name: string, value: string) => void
  required?: boolean
}

/**
 * Dependent Județ → Localitate pickers backed by the official RO localities
 * dataset, so the submitted province/city are always values the courier
 * (Europarcel) recognises. Renders hidden inputs under the given field names
 * for native FormData submission, and also calls onChange for controlled forms.
 */
const LocalitySelect = ({
  countyFieldName,
  cityFieldName,
  countyValue,
  cityValue,
  onChange,
  required,
}: LocalitySelectProps) => {
  const t = useTranslations("common")
  const [counties, setCounties] = useState<County[]>([])
  const [localities, setLocalities] = useState<Locality[]>([])
  const [county, setCounty] = useState<County | null>(null)
  const [city, setCity] = useState<Locality | null>(null)

  const countyProbe = useRef<HTMLInputElement>(null)
  const cityProbe = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCounties().then(setCounties)
  }, [])

  // Autofill-ul nu declanșează întotdeauna `onChange` în React — Chrome
  // completează uneori câmpurile înainte de hidratare, iar unele browsere
  // umplu tot formularul fără niciun eveniment de input. Citim direct
  // valoarea punților de câteva ori după montare, ca să prindem și cazul ăla.
  // Doar completăm ce lipsește: dacă utilizatorul a ales deja ceva manual,
  // nu îl suprascriem.
  useEffect(() => {
    const push = () => {
      const c = countyProbe.current?.value?.trim()
      if (c && !countyValue) onChange?.(countyFieldName, c)
      const l = cityProbe.current?.value?.trim()
      if (l && !cityValue) onChange?.(cityFieldName, l)
    }
    const timers = [150, 600, 1500].map((ms) => setTimeout(push, ms))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preselect county from an incoming value (e.g. saved/edited address).
  // Tolerant matching: older addresses may store the value without
  // diacritics ("Bucuresti"), with different casing, extra whitespace, or as
  // the county code ("CJ") — normalize before comparing.
  useEffect(() => {
    if (!counties.length || !countyValue) return
    const wanted = normalize(countyValue)
    const match =
      counties.find((c) => normalize(c.name) === wanted) ??
      counties.find((c) => normalize(c.code) === wanted)
    if (match && match.id !== county?.id) setCounty(match)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counties, countyValue])

  // Load localities whenever the selected county changes.
  useEffect(() => {
    if (!county) {
      setLocalities([])
      return
    }
    fetchLocalities(county.id).then(setLocalities)
  }, [county])

  // Preselect locality from an incoming value once its county's list is loaded.
  useEffect(() => {
    if (!localities.length || !cityValue) return
    const wanted = normalize(cityValue)
    const match = localities.find((l) => normalize(l.name) === wanted)
    if (match && match.id !== city?.id) setCity(match)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localities, cityValue])

  const handleCounty = (c: County | null) => {
    setCounty(c)
    setCity(null)
    onChange?.(countyFieldName, c?.name ?? "")
    onChange?.(cityFieldName, "")
  }

  const handleCity = (l: Locality | null) => {
    setCity(l)
    onChange?.(cityFieldName, l?.name ?? "")
  }

  return (
    <>
      {/* Valorile trimise cu formularul — mereu numele canonic din dataset,
          niciodată textul brut scris de browser. */}
      <input type="hidden" name={countyFieldName} value={county?.name ?? ""} />
      <input type="hidden" name={cityFieldName} value={city?.name ?? ""} />

      {/* Punți pentru autofill-ul browserului. Județul și localitatea sunt
          Combobox-uri headlessui, a căror valoare stă în state React — browserul
          nu are ce completa, așa că le umplea pe toate celelalte câmpuri și pe
          acestea două le lăsa goale.
          Input-urile de mai jos SUNT native și au atributele `autocomplete`
          standard, deci browserul le populează. Valoarea lor e împinsă în
          starea părintelui, de unde revine ca `countyValue`/`cityValue` și
          intră exact pe potrivirea tolerantă folosită și la adresele salvate.
          Nu pot fi `type="hidden"` sau `display:none` — browserele sar peste
          astfel de câmpuri la autofill; de aceea sunt doar invizibile. */}
      <input
        ref={countyProbe}
        name="autofill-address-level1"
        autoComplete="address-level1"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute h-px w-px opacity-0 pointer-events-none -z-10"
        onChange={(e) => onChange?.(countyFieldName, e.target.value)}
      />
      <input
        ref={cityProbe}
        name="autofill-address-level2"
        autoComplete="address-level2"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute h-px w-px opacity-0 pointer-events-none -z-10"
        onChange={(e) => onChange?.(cityFieldName, e.target.value)}
      />
      <ComboField
        label={t("Județ")}
        required={required}
        value={county}
        options={counties}
        onSelect={handleCounty}
        placeholder={t("Caută județ")}
        testId="province-select"
        fieldName={countyFieldName}
        requiredMessage={t("Acest câmp este obligatoriu")}
        noResultsLabel={t("Niciun rezultat")}
        typeToSearchLabel={t("Scrie pentru a căuta…")}
      />
      <ComboField
        key={county?.id ?? "no-county"}
        label={t("Localitate")}
        required={required}
        value={city}
        options={localities}
        onSelect={handleCity}
        fieldName={cityFieldName}
        disabled={!county}
        placeholder={county ? t("Caută localitate") : t("Alege întâi județul")}
        testId="city-select"
        requiredMessage={t("Acest câmp este obligatoriu")}
        noResultsLabel={t("Niciun rezultat")}
        typeToSearchLabel={t("Scrie pentru a căuta…")}
      />
    </>
  )
}

export default LocalitySelect
