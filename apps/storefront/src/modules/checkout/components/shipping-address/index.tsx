import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"
import Checkbox from "@modules/common/components/checkbox"
import Input from "@modules/common/components/input"
import mapKeys from "lodash/mapKeys"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"
import LocalitySelect from "@modules/common/components/locality-select"

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
  onBillingAddressSelected,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
  // Called (with the picked address) when it's flagged as a billing address
  // — using it as the shipping destination too would silently ship the
  // order there, so "same as billing" shouldn't stay assumed, and the
  // billing form should be prefilled with this same address (company
  // included) rather than left blank.
  onBillingAddressSelected?: (address: HttpTypes.StoreCartAddress) => void
}) => {
  const t = useTranslations("checkout")
  const [formData, setFormData] = useState<Record<string, string>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code": cart?.shipping_address?.country_code || "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    email: cart?.email || "",
  })

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    if (address) {
      setFormData((prevState: Record<string, string>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": address?.country_code || "",
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
      }))
      if ((address as unknown as HttpTypes.StoreCustomerAddress).is_default_billing) {
        onBillingAddressSelected?.(address)
      }
    }

    if (email) {
      setFormData((prevState: Record<string, string>) => ({
        ...prevState,
        email: email,
      }))
    }
  }

  // Hydrates the form from the cart exactly once, on the first snapshot that
  // has data. Re-running this on every `cart` change (its identity changes
  // on every server refetch — applying a discount, changing a quantity,
  // CartRefreshOnUpdate polling, etc.) would overwrite whatever the customer
  // is actively typing with the last server-saved values.
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current || !cart) return

    if (cart.shipping_address) {
      setFormAddress(cart.shipping_address, cart.email)
      hydrated.current = true
    } else if (!cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
      hydrated.current = true
    }
  }, [cart])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    // Functional update — LocalitySelect's onChange (county/city) also
    // updates this same state via its own functional setter, and a keystroke
    // batched in the same tick as a locality selection must not silently
    // drop one of the two updates by closing over a stale `formData`.
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-5">
          <p className="text-small-regular text-[var(--theme-text-muted)]">
            {t("Salut {name}, vrei să folosești una dintre adresele salvate?", { name: customer.first_name ?? "" })}
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", "")
              ) as unknown as HttpTypes.StoreCartAddress
            }
            onSelect={setFormAddress}
          />
        </Container>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t("Prenume")}
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          enterKeyHint="next"
          data-testid="shipping-first-name-input"
        />
        <Input
          label={t("Nume de familie")}
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          enterKeyHint="next"
          data-testid="shipping-last-name-input"
        />
        <Input
          label={t("Adresă")}
          name="shipping_address.address_1"
          autoComplete="address-line1"
          value={formData["shipping_address.address_1"]}
          onChange={handleChange}
          required
          enterKeyHint="next"
          data-testid="shipping-address-input"
        />
        <Input
          label={t("Cod poștal")}
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          required
          enterKeyHint="next"
          data-testid="shipping-postal-code-input"
        />
        <CountrySelect
          name="shipping_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["shipping_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-country-select"
        />
        <LocalitySelect
          countyFieldName="shipping_address.province"
          cityFieldName="shipping_address.city"
          countyValue={formData["shipping_address.province"]}
          cityValue={formData["shipping_address.city"]}
          onChange={(name, value) =>
            setFormData((prev) => ({ ...prev, [name]: value }))
          }
          required
        />
      </div>
      <div className="my-8 flex items-center gap-3 cursor-pointer" onClick={onChange} data-testid="billing-address-checkbox">
        <div className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-colors ${checked ? "border-hunter-gold bg-hunter-gold" : "border-[var(--theme-border)]"}`}>
          {checked && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1.5 4.5l2 2 4-4" stroke="#0D0D0D" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <input type="checkbox" name="same_as_billing" checked={checked} readOnly className="sr-only" />
        <span className="font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
          {t("Adresa de facturare este aceeași cu cea de livrare")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Input
          label={t("Email")}
          name="email"
          type="email"
          title={t("Enter a valid email address")}
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          enterKeyHint="next"
          data-testid="shipping-email-input"
        />
        <Input
          label={t("Telefon")}
          name="shipping_address.phone"
          type="tel"
          autoComplete="tel"
          pattern="^\+?[0-9][0-9\s\-.()]{6,16}[0-9]$"
          title={t("Introdu un număr de telefon valid")}
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          required
          data-testid="shipping-phone-input"
        />
      </div>
    </>
  )
}

export default ShippingAddress
