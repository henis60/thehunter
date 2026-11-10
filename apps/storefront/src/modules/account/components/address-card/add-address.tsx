"use client"

import { useTranslations } from "next-intl"
import { Plus } from "@medusajs/icons"
import { useActionState, useEffect, useState } from "react"

import { addCustomerAddress } from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { HttpTypes } from "@medusajs/types"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalitySelect from "@modules/common/components/locality-select"
import Modal from "@modules/common/components/modal"

const AddAddress = ({
  region,
  addresses,
}: {
  region: HttpTypes.StoreRegion
  addresses: HttpTypes.StoreCustomerAddress[]
}) => {
  const t = useTranslations("account")
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)
  // Bumped on close so the <form> (and every Input inside it) fully remounts
  // next time the modal opens — a native form reset restores input values
  // but doesn't fire change events, so Input's own inline validation errors
  // would otherwise still be showing on reopen.
  const [formKey, setFormKey] = useState(0)

  const [formState, formAction] = useActionState(addCustomerAddress, {
    success: false,
    error: null,
  } as { success: boolean; error: string | null })

  const close = () => {
    setSuccessState(false)
    setFormKey((k) => k + 1)
    closeModal()
  }

  useEffect(() => {
    if (successState) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successState])

  useEffect(() => {
    if (formState.success) setSuccessState(true)
  }, [formState])

  return (
    <>
      <button
        className="border border-dashed border-[var(--theme-border)] px-6 py-6 min-h-[80px] flex items-center justify-center gap-3 w-full text-[var(--theme-text-muted)] hover:border-hunter-gold hover:text-hunter-gold transition-colors group"
        onClick={open}
        data-testid="add-address-button"
      >
        <Plus className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="font-sans text-[11px] uppercase tracking-[3px]">
          {t("Adaugă adresă nouă")}
        </span>
      </button>

      <Modal isOpen={state} close={close} data-testid="add-address-modal">
        <Modal.Title>
          <span className="font-display text-[22px] leading-[1]">
            {t("Adaugă adresă")}
          </span>
        </Modal.Title>
        <form key={formKey} action={formAction} className="flex flex-col flex-1 min-h-0">
          <Modal.Body>
            <div className="flex flex-col gap-y-2 w-full">
              <div className="grid grid-cols-1 gap-y-2">
                <Input
                  label={t("Prenume")}
                  name="first_name"
                  required
                  autoComplete="given-name"
                  enterKeyHint="next"
                  data-testid="first-name-input"
                />
                <Input
                  label={t("Nume")}
                  name="last_name"
                  required
                  autoComplete="family-name"
                  enterKeyHint="next"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label={t("Companie (opțional)")}
                name="company"
                autoComplete="organization"
                enterKeyHint="next"
                data-testid="company-input"
              />
              <Input
                label={t("Adresă")}
                name="address_1"
                required
                autoComplete="address-line1"
                enterKeyHint="next"
                data-testid="address-1-input"
              />
              <Input
                label={t("Apartament, etaj, etc")}
                name="address_2"
                autoComplete="address-line2"
                enterKeyHint="next"
                data-testid="address-2-input"
              />
              <Input
                label={t("Cod poștal")}
                name="postal_code"
                autoComplete="postal-code"
                required
                enterKeyHint="next"
                data-testid="postal-code-input"
              />
              <LocalitySelect
                countyFieldName="province"
                cityFieldName="city"
                required
              />
              {/* Shipping is RO-only — country is fixed, not user-facing */}
              <input type="hidden" name="country_code" value="ro" />
              <Input
                label={t("Telefon")}
                name="phone"
                type="tel"
                autoComplete="tel"
                pattern="^\+?[0-9][0-9\s\-.()]{6,16}[0-9]$"
                title={t("Introdu un număr de telefon valid")}
                required
                data-testid="phone-input"
              />
              <label className="flex items-center gap-3 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_default_billing"
                  className="h-4 w-4 shrink-0 accent-[var(--theme-gold)]"
                  data-testid="billing-checkbox"
                />
                <span className="font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text-muted)]">
                  {t("Folosește pentru facturare")}
                </span>
              </label>
            </div>
            {formState.error && (
              <p
                className="font-sans text-[12px] text-rose-500 mt-2"
                data-testid="address-error"
              >
                {formState.error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-3 mt-6">
              <button
                type="reset"
                onClick={close}
                className="h-10 px-6 font-sans text-[12px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] transition-colors"
                data-testid="cancel-button"
              >
                {t("Anulează")}
              </button>
              <SubmitButton
                className="h-10 px-6 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent font-sans uppercase tracking-[3px] text-[12px]"
                data-testid="save-button"
              >
                {t("Salvează")}
              </SubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default AddAddress
