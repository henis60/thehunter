"use client"
import { Radio, RadioGroup } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import {
  EawbLocker,
  EawbLockerOrigin,
  getEawbOrigin,
  listEawbLockers,
  listEawbShippingPrices,
} from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import { haversineKm } from "@lib/util/geo"
import {
  lineItemsToTrackItems,
  trackAddShippingInfo,
} from "@lib/util/analytics"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import Spinner from "@modules/common/icons/spinner"
import LockerPicker from "./locker-map/locker-picker"
import {
  bodyMutedClass,
  ctaButtonClass,
  editLinkClass,
  fieldLabelClass,
  priceTextClass,
  sectionTitleClass,
} from "@modules/checkout/components/typography"
import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@i18n/navigation"
import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { getDisplayableErrorMessage } from "@lib/util/stale-deployment"
import {
  isDropshipOption,
  itemShippingProfileId,
  requiredShippingProfiles,
} from "@lib/util/dropshipping"

// A shipping option that delivers to a parcel locker requires the customer
// to pick a specific locker. Detection is purely structural: the eAWB
// provider stores the Europarcel service on the option's data, and services
// 2 (door→locker) and 4 (locker→locker) deliver to a locker. Non-eAWB
// options never open the picker — it can only list eAWB lockers anyway.
const LOCKER_SERVICE_IDS = [2, 4]

const isLockerOption = (o: HttpTypes.StoreCartShippingOption) => {
  const serviceId = Number((o.data as { service_id?: number })?.service_id)
  return LOCKER_SERVICE_IDS.includes(serviceId)
}

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

function formatAddress(address: HttpTypes.StoreCartAddress) {
  if (!address) return ""
  let ret = ""
  if (address.address_1) ret += ` ${address.address_1}`
  if (address.address_2) ret += `, ${address.address_2}`
  if (address.postal_code) ret += `, ${address.postal_code} ${address.city}`
  if (address.country_code) ret += `, ${address.country_code.toUpperCase()}`
  return ret
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const t = useTranslations("checkout")
  const locale = useLocale()

  // Coș mixt: produsele obișnuite pleacă prin curier (metoda aleasă mai jos),
  // cele în dropshipping au livrarea lor gratuită, de la furnizor — setată
  // automat. Fiecare are propria metodă de livrare pe coș.
  const requiredProfiles = requiredShippingProfiles(cart)
  const profileApplies = (o: HttpTypes.StoreCartShippingOption) =>
    !requiredProfiles || requiredProfiles.has(o.shipping_profile_id)
  const dropshipOption = availableShippingMethods?.find(
    (o) => isDropshipOption(o) && profileApplies(o)
  )
  const dropshipProfileIds = new Set(
    (availableShippingMethods ?? [])
      .filter(isDropshipOption)
      .map((o) => o.shipping_profile_id)
  )
  const dropshipItems = (cart.items ?? []).filter((i) => {
    const profile = itemShippingProfileId(i)
    return !!profile && dropshipProfileIds.has(profile)
  })
  const needsDropship = dropshipItems.length > 0
  // Fără informația de profil (null) păstrăm comportamentul vechi: curier.
  const needsCourier =
    !requiredProfiles ||
    Array.from(requiredProfiles).some((p) => !dropshipProfileIds.has(p))
  const dropshipMethodSet =
    !!dropshipOption &&
    !!cart.shipping_methods?.some(
      (sm) => sm.shipping_option_id === dropshipOption.id
    )
  const courierMethodOnCart = cart.shipping_methods
    ?.filter(
      (sm) => !dropshipOption || sm.shipping_option_id !== dropshipOption.id
    )
    .at(-1)

  const [isLoading, setIsLoading] = useState(false)
  const [dropshipError, setDropshipError] = useState<string | null>(null)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)
  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)
  // Why the last price fetch failed, or null when it succeeded. Never confused
  // with a genuine "no courier serves this address" (empty prices map) result,
  // and the two failure reasons are kept apart on purpose: "unavailable" is
  // worth retrying, "address_rejected" never is — offering Retry there is what
  // made a customer attempt the same impossible checkout three times.
  const [pricesError, setPricesError] = useState<
    "address_rejected" | "unavailable" | null
  >(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    needsCourier ? courierMethodOnCart?.shipping_option_id || null : null
  )
  // Locker picker state (for "...to locker" services).
  const [lockerOptionId, setLockerOptionId] = useState<string | null>(null)
  const [lockers, setLockers] = useState<EawbLocker[]>([])
  const [loadingLockers, setLoadingLockers] = useState(false)
  const [selectedLocker, setSelectedLocker] = useState<EawbLocker | null>(null)
  const [lockerQuery, setLockerQuery] = useState("")
  const [lockerOrigin, setLockerOrigin] = useState<EawbLockerOrigin>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("pas") === "livrare"

  const courierCandidates = needsCourier
    ? availableShippingMethods?.filter(
        (sm) => !isDropshipOption(sm) && profileApplies(sm)
      )
    : []
  const _shippingMethods = courierCandidates?.filter(
    (sm) => (sm as any).service_zone?.fulfillment_set?.type !== "pickup"
  )
  const _pickupMethods = courierCandidates?.filter(
    (sm) => (sm as any).service_zone?.fulfillment_set?.type === "pickup"
  )
  const hasPickupOptions = !!_pickupMethods?.length

  // Show only options that are actually offered: flat-rate ones always, and
  // calculated ones only once they have a price (a courier that's inactive in
  // the eAWB account or doesn't serve the address returns no price). While
  // prices are loading we still show the calculated options with a spinner.
  //
  // The option already saved on the cart (shippingMethodId) is always kept
  // visible too, regardless of what the live re-price call just returned —
  // returning to this step later re-fetches current prices, and if that
  // call transiently fails or omits an option (rate limiting, a courier
  // that's briefly unavailable), a customer who already has a valid,
  // previously-confirmed selection (e.g. a locker they picked) would
  // otherwise see it vanish and get told no courier serves their address at
  // all — even though their shipping method is still genuinely set.
  const visibleShippingMethods = _shippingMethods?.filter(
    (o) =>
      o.price_type !== "calculated" ||
      isLoadingPrices ||
      (calculatedPricesMap[o.id] ?? 0) > 0 ||
      o.id === shippingMethodId
  )

  const fetchPrices = useCallback(() => {
    setIsLoadingPrices(true)
    setPricesError(null)
    // One request for all calculated options (backend queries Europarcel once).
    // The backend already returns only positive prices; options absent from
    // the map are treated as unavailable and disabled below.
    listEawbShippingPrices(cart.id)
      .then((result) => {
        if (result.ok) {
          setCalculatedPricesMap(result.prices)
        } else {
          setPricesError(result.reason)
        }
      })
      .catch(() => {
        setPricesError("unavailable")
      })
      .finally(() => setIsLoadingPrices(false))
  }, [cart.id])

  // Refetch only when the destination actually changes (address or item
  // quantities, which the delivery price can depend on) — not on every
  // re-render/re-visit of this step with the same destination.
  const a = cart.shipping_address
  const itemCount = (cart.items ?? []).reduce(
    (s, i) => s + (i.quantity ?? 0),
    0
  )
  const destinationSignature = [
    cart.id,
    a?.city ?? "",
    a?.province ?? "",
    a?.address_1 ?? "",
    a?.country_code ?? "",
    itemCount,
  ].join("|")

  useEffect(() => {
    const hasCalculated = _shippingMethods?.some(
      (sm) => sm.price_type === "calculated"
    )
    if (hasCalculated) {
      fetchPrices()
    } else {
      setIsLoadingPrices(false)
    }
  }, [destinationSignature, needsCourier])

  // Livrarea gratuită pentru produsele în dropshipping nu are ce alege, deci se
  // setează singură. Tot aici se curăță o metodă rămasă fără produse (de ex.
  // curierul plătit, după ce clientul a scos produsele obișnuite): ruta din
  // backend păstrează doar metodele profilurilor încă prezente în coș.
  const methodIds = (cart.shipping_methods ?? [])
    .map((sm) => sm.shipping_option_id)
    .join("|")
  const hasStaleCourierMethod = !needsCourier && !!courierMethodOnCart
  useEffect(() => {
    if (!isOpen || !needsDropship || !dropshipOption) return
    if (dropshipMethodSet && !hasStaleCourierMethod) return
    setDropshipError(null)
    setShippingMethod({
      cartId: cart.id,
      shippingMethodId: dropshipOption.id,
    }).catch((err) =>
      setDropshipError(
        getDisplayableErrorMessage(err, t("A apărut o eroare Reîncearcă"))
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, needsDropship, dropshipOption?.id, methodIds, hasStaleCourierMethod])

  useEffect(() => {
    if (_pickupMethods?.find((m) => m.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [availableShippingMethods])

  const handleEdit = () =>
    router.push(pathname + "?pas=livrare", { scroll: false })
  const handleSubmit = () => {
    const tier = availableShippingMethods?.find(
      (m) => m.id === shippingMethodId
    )?.name
    trackAddShippingInfo(
      lineItemsToTrackItems(cart.items),
      cart.currency_code?.toUpperCase() || "RON",
      cart.total ?? undefined,
      tier ?? undefined
    )
    router.push(pathname + "?pas=sumar", { scroll: false })
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup",
    data?: Record<string, unknown>
  ) => {
    setError(null)
    if (variant === "pickup") setShowPickupOptions(PICKUP_OPTION_ON)
    else setShowPickupOptions(PICKUP_OPTION_OFF)
    let currentId: string | null = null
    setIsLoading(true)
    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })
    await setShippingMethod({ cartId: cart.id, shippingMethodId: id, data })
      .catch((err) => {
        setShippingMethodId(currentId)
        setError(getDisplayableErrorMessage(err, t("A apărut o eroare Reîncearcă")))
      })
      .finally(() => setIsLoading(false))
  }

  // Picking a shipping option: locker services open the locker picker and are
  // only committed once a locker is chosen; all others commit immediately.
  const handleSelectOption = (option: HttpTypes.StoreCartShippingOption) => {
    if (isLockerOption(option)) {
      setShippingMethodId(option.id)
      setLockerOptionId(option.id)
      setSelectedLocker(null)
      setLockerQuery("")
      setLockerOrigin(null)
      setLoadingLockers(true)
      listEawbLockers(option.id, cart.id).then((ls) => {
        setLockers(ls)
        setLoadingLockers(false)
      })
      // Fetched separately so Nominatim's latency never delays the locker
      // list/map from showing — the map just re-centers once this resolves.
      getEawbOrigin(cart.id).then(setLockerOrigin)
    } else {
      setLockerOptionId(null)
      setSelectedLocker(null)
      handleSetShippingMethod(option.id, "shipping")
    }
  }

  const handleSelectLocker = (locker: EawbLocker | null) => {
    if (!locker || !lockerOptionId) return
    setSelectedLocker(locker)
    handleSetShippingMethod(lockerOptionId, "shipping", {
      fixed_location_id: locker.id,
      locker_name: locker.name,
    })
  }

  // Once both the locker list and the geocoded address are in, auto-pick the
  // closest locker — unless one's already selected (e.g. restored from cart).
  useEffect(() => {
    if (!lockerOptionId || selectedLocker || !lockerOrigin) return
    const withCoords = lockers.filter((l) => l.lat != null && l.lng != null)
    if (withCoords.length === 0) return
    const nearest = withCoords.reduce((best, l) =>
      haversineKm(lockerOrigin, {
        lat: l.lat as number,
        lng: l.lng as number,
      }) <
      haversineKm(lockerOrigin, {
        lat: best.lat as number,
        lng: best.lng as number,
      })
        ? l
        : best
    )
    handleSelectLocker(nearest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockers, lockerOrigin, lockerOptionId, selectedLocker])

  const filteredLockers = lockerQuery
    ? lockers.filter((l) =>
        `${l.name} ${l.address}`
          .toLowerCase()
          .includes(lockerQuery.trim().toLowerCase())
      )
    : lockers

  useEffect(() => {
    setError(null)
  }, [isOpen])

  // Reopen the locker picker when returning to the step with a locker service
  // already selected on the cart. Doesn't restore the previous locker itself
  // (it has no coordinates to center the map on) — the nearest-locker effect
  // below re-picks one once the list and geocoded address load, same as a
  // fresh selection. Skips if a locker is already being handled in this
  // session, so committing a selection (which updates the cart) doesn't
  // re-trigger a reload.
  useEffect(() => {
    if (lockerOptionId) return
    const sm = cart.shipping_methods?.at(-1)
    const optId = sm?.shipping_option_id
    if (!optId) return
    const opt = availableShippingMethods?.find((o) => o.id === optId)
    if (!opt || !isLockerOption(opt)) return

    setLockerOptionId(opt.id)
    setLoadingLockers(true)
    listEawbLockers(opt.id, cart.id).then((ls) => {
      setLockers(ls)
      setLoadingLockers(false)
    })
    getEawbOrigin(cart.id).then(setLockerOrigin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableShippingMethods])

  const radioClass = (selected: boolean, disabled?: boolean) =>
    `flex items-center justify-between py-3 px-4 border mb-2 cursor-pointer transition-colors ${
      selected
        ? "border-hunter-gold bg-hunter-gold/5"
        : disabled
        ? "border-[var(--theme-border)] opacity-40 cursor-not-allowed"
        : "border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]"
    }`

  return (
    <div
      className={
        !isOpen && (cart.shipping_methods?.length ?? 0) === 0
          ? "opacity-50 pointer-events-none select-none"
          : ""
      }
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className={sectionTitleClass}>{t("Livrare")}</span>
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="text-hunter-gold"
            >
              <circle
                cx="6"
                cy="6"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1"
              />
              <path
                d="M3.5 6l1.8 1.8L8.5 4.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <button
              onClick={handleEdit}
              className={editLinkClass}
              data-testid="edit-delivery-button"
            >
              {t("Modifică")}
            </button>
          )}
      </div>

      {isOpen ? (
        <>
          <div
            data-testid="delivery-options-container"
            className={needsCourier ? "mb-6" : "hidden"}
          >
            {hasPickupOptions && (
              <RadioGroup
                value={showPickupOptions}
                onChange={() => {
                  const id = _pickupMethods?.find(
                    (o) => !o.insufficient_inventory
                  )?.id
                  if (id) handleSetShippingMethod(id, "pickup")
                }}
              >
                <Radio
                  value={PICKUP_OPTION_ON}
                  data-testid="delivery-option-radio"
                  className={radioClass(showPickupOptions === PICKUP_OPTION_ON)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-3 h-3 rounded-full border flex-shrink-0 ${
                        showPickupOptions === PICKUP_OPTION_ON
                          ? "border-hunter-gold bg-hunter-gold"
                          : "border-[var(--theme-border)]"
                      }`}
                    />
                    <span className="font-serif text-[15px] text-[var(--theme-text)]">
                      {t("Ridicare din magazin")}
                    </span>
                  </div>
                  <span className={priceTextClass}>—</span>
                </Radio>
              </RadioGroup>
            )}

            {isLoadingPrices ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: _shippingMethods?.length || 3 }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3 border border-[var(--theme-border)] animate-pulse"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[var(--theme-border)]" />
                        <div className="h-3 w-32 rounded bg-[var(--theme-border)]" />
                      </div>
                      <div className="h-3 w-16 rounded bg-[var(--theme-border)]" />
                    </div>
                  )
                )}
              </div>
            ) : (
              <RadioGroup
                value={shippingMethodId}
                onChange={(v) => {
                  const opt = _shippingMethods?.find((o) => o.id === v)
                  if (opt) handleSelectOption(opt)
                }}
              >
                {visibleShippingMethods?.map((option) => {
                  return (
                    <Radio
                      key={option.id}
                      value={option.id}
                      data-testid="delivery-option-radio"
                      className={radioClass(option.id === shippingMethodId)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3 h-3 rounded-full border flex-shrink-0 ${
                            option.id === shippingMethodId
                              ? "border-hunter-gold bg-hunter-gold"
                              : "border-[var(--theme-border)]"
                          }`}
                        />
                        <span className="font-serif text-[15px] text-[var(--theme-text)]">
                          {option.name}
                        </span>
                      </div>
                      <span
                        className={
                          option.price_type !== "flat" &&
                          !calculatedPricesMap[option.id]
                            ? bodyMutedClass
                            : priceTextClass
                        }
                      >
                        {option.price_type === "flat"
                          ? convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })
                          : calculatedPricesMap[option.id]
                          ? convertToLocale({
                              amount: calculatedPricesMap[option.id],
                              currency_code: cart?.currency_code,
                            })
                          : t("Indisponibil")}
                      </span>
                    </Radio>
                  )
                })}
              </RadioGroup>
            )}

            {/* Curierul a respins adresa: reîncercarea dă acelaşi rezultat de
                fiecare dată, deci singura acţiune utilă e corectarea adresei. */}
            {!isLoadingPrices && pricesError === "address_rejected" && (
              <div className="flex items-center justify-between gap-3 py-2">
                <p className={bodyMutedClass}>
                  {t(
                    "Curierul nu a acceptat adresa de livrare Verifică strada și numărul, apoi încearcă din nou"
                  )}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`${pathname}?pas=adresa`, { scroll: false })
                  }
                  className="font-sans text-[11px] uppercase tracking-[2px] text-hunter-gold hover:underline shrink-0"
                >
                  {t("Modifică adresa")}
                </button>
              </div>
            )}

            {!isLoadingPrices && pricesError === "unavailable" && (
              <div className="flex items-center justify-between gap-3 py-2">
                <p className={bodyMutedClass}>
                  {t(
                    "Nu am putut verifica prețurile de livrare Încearcă din nou"
                  )}
                </p>
                <button
                  type="button"
                  onClick={fetchPrices}
                  className="font-sans text-[11px] uppercase tracking-[2px] text-hunter-gold hover:underline shrink-0"
                >
                  {t("Reîncearcă")}
                </button>
              </div>
            )}

            {!isLoadingPrices &&
              !pricesError &&
              needsCourier &&
              (visibleShippingMethods?.length ?? 0) === 0 &&
              !hasPickupOptions && (
                <p className={`${bodyMutedClass} py-2`}>
                  {t(
                    "Niciun curier nu livrează la această adresă Verifică adresa de livrare"
                  )}
                </p>
              )}

            {lockerOptionId && (
              <div className="mt-2 mb-2 border border-[var(--theme-border)] p-4 flex flex-col gap-2">
                <span className={fieldLabelClass}>
                  {t("Alege lockerul")} <span className="text-rose-500">*</span>
                </span>
                <LockerPicker
                  lockers={lockers}
                  filteredLockers={filteredLockers}
                  loadingLockers={loadingLockers}
                  origin={lockerOrigin}
                  selectedLocker={selectedLocker}
                  onSelectLocker={handleSelectLocker}
                  lockerQuery={lockerQuery}
                  onQueryChange={setLockerQuery}
                />
              </div>
            )}
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && (
            <RadioGroup
              value={shippingMethodId}
              onChange={(v) => {
                if (v) handleSetShippingMethod(v, "pickup")
              }}
              className="mb-6"
            >
              {_pickupMethods?.map((option) => (
                <Radio
                  key={option.id}
                  value={option.id}
                  disabled={option.insufficient_inventory}
                  data-testid="delivery-option-radio"
                  className={radioClass(
                    option.id === shippingMethodId,
                    option.insufficient_inventory
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-3 h-3 rounded-full border flex-shrink-0 mt-0.5 ${
                        option.id === shippingMethodId
                          ? "border-hunter-gold bg-hunter-gold"
                          : "border-[var(--theme-border)]"
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="font-serif text-[15px] text-[var(--theme-text)]">
                        {option.name}
                      </span>
                      <span className="font-serif italic text-[13px] text-[var(--theme-text-muted)]">
                        {formatAddress(
                          (option as any).service_zone?.fulfillment_set
                            ?.location?.address as HttpTypes.StoreCartAddress
                        )}
                      </span>
                    </div>
                  </div>
                  <span className={priceTextClass}>
                    {convertToLocale({
                      amount: option.amount!,
                      currency_code: cart?.currency_code,
                    })}
                  </span>
                </Radio>
              ))}
            </RadioGroup>
          )}

          {/* Clientul vede un singur transport: curierul, dacă există produse
              obișnuite în coș, altfel livrarea gratuită. Metoda gratuită pentru
              produsele în dropshipping se setează oricum pe coș, în fundal
              (Medusa cere câte o metodă per profil de livrare). */}
          {needsDropship && (
            <div className="mb-6" data-testid="dropship-delivery">
              {!needsCourier &&
                (dropshipOption ? (
                  <div className={radioClass(true)}>
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full border flex-shrink-0 border-hunter-gold bg-hunter-gold" />
                      <span className="font-serif text-[15px] text-[var(--theme-text)]">
                        {/* Medusa nu traduce opțiunile de livrare: în română
                            rămâne numele din admin, altfel textul tradus. */}
                        {locale === "ro"
                          ? dropshipOption.name
                          : t("Livrare gratuită (7–10 zile)")}
                      </span>
                    </div>
                    <span className={priceTextClass}>{t("Gratuit")}</span>
                  </div>
                ) : (
                  <p className={`${bodyMutedClass} py-2`}>
                    {t(
                      "Livrarea pentru unele produse nu este disponibilă momentan Contactează-ne"
                    )}
                  </p>
                ))}
              {needsCourier && !dropshipOption && (
                <p className={`${bodyMutedClass} py-2`}>
                  {t(
                    "Livrarea pentru unele produse nu este disponibilă momentan Contactează-ne"
                  )}
                </p>
              )}
              <ErrorMessage
                error={dropshipError}
                data-testid="dropship-error-message"
              />
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="delivery-option-error-message"
          />
          <button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              (needsCourier && !shippingMethodId) ||
              (needsDropship && !dropshipMethodSet) ||
              hasStaleCourierMethod ||
              // A locker service is selected but no locker chosen yet.
              (!!lockerOptionId && !selectedLocker)
            }
            data-testid="submit-delivery-option-button"
            className={`relative overflow-hidden ${ctaButtonClass}`}
          >
            <span
              className={`flex items-center justify-center gap-2 transition-opacity duration-150 ${
                isLoading ? "opacity-0" : "opacity-100"
              }`}
            >
              {t("Continuă cu confirmarea")}
            </span>
            {isLoading && (
              <span className="absolute inset-0 flex items-center justify-center gap-2">
                <Spinner size="14" />
                {t("Se procesează…")}
              </span>
            )}
          </button>
        </>
      ) : (
        <div>
          {cart && cart.shipping_methods?.some((sm) => (sm.amount ?? 0) > 0) && (
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>{t("Metodă")}</span>
              {/* Livrarea gratuită nu se menționează — doar metodele plătite. */}
              {cart
                .shipping_methods!.filter((sm) => (sm.amount ?? 0) > 0)
                .map((sm) => (
                <span
                  key={sm.id}
                  className="font-serif italic text-[15px] text-[var(--theme-text)]"
                >
                  {sm.name}{" "}
                  <span className={priceTextClass}>
                    {convertToLocale({
                      amount: sm.amount,
                      currency_code: cart?.currency_code,
                    })}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
