import { Listbox, Transition } from "@headlessui/react"
import { Fragment, useMemo } from "react"
import compareAddresses from "@lib/util/compare-addresses"
import { HttpTypes } from "@medusajs/types"
import { useTranslations } from "next-intl"

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[]
  addressInput: HttpTypes.StoreCartAddress | null
  onSelect: (address: HttpTypes.StoreCartAddress | undefined, email?: string) => void
}

const AddressSelect = ({ addresses, addressInput, onSelect }: AddressSelectProps) => {
  const t = useTranslations("checkout")
  const handleSelect = (id: string) => {
    const saved = addresses.find((a) => a.id === id)
    if (saved) onSelect(saved as HttpTypes.StoreCartAddress)
  }

  const selectedAddress = useMemo(
    () => addresses.find((a) => addressInput && compareAddresses(a, addressInput)),
    [addresses, addressInput]
  )

  return (
    <Listbox onChange={handleSelect} value={selectedAddress?.id ?? ""}>
      <div className="relative">
        <Listbox.Button
          className="relative w-full flex justify-between items-center px-3 h-10 text-left bg-transparent border border-[var(--theme-border)] focus:outline-none focus:border-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] transition-colors cursor-default"
          data-testid="shipping-address-select"
        >
          {({ open }) => (
            <>
              <span className="font-sans text-[14px] text-[var(--theme-text)] truncate">
                {selectedAddress ? selectedAddress.address_1 : t("Alege o adresă salvată")}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-[var(--theme-text-muted)] transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </>
          )}
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className="absolute z-20 w-full overflow-auto bg-[var(--theme-bg)] border border-[var(--theme-border)] max-h-60 focus:outline-none"
            data-testid="shipping-address-options"
          >
            {addresses.map((address) => (
              <Listbox.Option
                key={address.id}
                value={address.id}
                className="cursor-pointer select-none px-4 py-3 hover:bg-[var(--theme-surface)] transition-colors"
                data-testid="shipping-address-option"
              >
                {({ selected }) => (
                  <div className="flex items-start gap-3">
                    <span className={`w-3 h-3 rounded-full border flex-shrink-0 mt-0.5 ${selected ? "border-hunter-gold bg-hunter-gold" : "border-[var(--theme-border)]"}`} />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-sans text-[13px] text-[var(--theme-text)] flex items-center gap-2">
                        {address.first_name} {address.last_name}
                        {address.is_default_billing && (
                          <span className="font-sans text-[11px] uppercase tracking-[2px] text-hunter-gold">
                            {t("Facturare")}
                          </span>
                        )}
                      </span>
                      {address.company && (
                        <span className="font-sans text-[12px] text-[var(--theme-text-muted)]">{address.company}</span>
                      )}
                      <span className="font-sans text-[12px] text-[var(--theme-text-muted)]">
                        {address.address_1}{address.address_2 && `, ${address.address_2}`}
                      </span>
                      <span className="font-sans text-[12px] text-[var(--theme-text-muted)]">
                        {address.postal_code}, {address.city}
                        {address.province && `, ${address.province}`}
                        {`, ${address.country_code?.toUpperCase()}`}
                      </span>
                    </div>
                  </div>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}

export default AddressSelect
