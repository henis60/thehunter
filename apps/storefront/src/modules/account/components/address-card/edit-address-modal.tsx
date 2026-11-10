"use client"

import { useTranslations } from "next-intl"
import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { Trash } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalitySelect from "@modules/common/components/locality-select"
import Modal from "@modules/common/components/modal"
import { clx } from "@modules/common/components/ui"
import Spinner from "@modules/common/icons/spinner"
import React, { useActionState, useEffect, useState } from "react"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
  isActive?: boolean
}

const EditAddress: React.FC<EditAddressProps> = ({
  region,
  address,
  isActive = false,
}) => {
  const t = useTranslations("account")
  const [removing, setRemoving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)
  // See add-address.tsx: forces the form (and its Inputs' inline error
  // state) to remount fresh on reopen instead of surviving a native reset.
  const [formKey, setFormKey] = useState(0)

  const [formState, formAction] = useActionState(updateCustomerAddress, {
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

  const removeAddress = async () => {
    if (removing) return
    if (!window.confirm(t("Sigur vrei să ștergi această adresă"))) return
    setRemoving(true)
    setActionError(null)
    const result = await deleteCustomerAddress(address.id)
    if (!result.success) {
      setActionError(result.error)
    }
    setRemoving(false)
  }


  return (
    <>
      <div
        className={clx(
          "border p-6 min-h-[200px] flex flex-col justify-between transition-colors",
          isActive
            ? "border-hunter-gold"
            : "border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]"
        )}
        data-testid="address-container"
      >
        <div className="flex flex-col gap-1">
          <p
            className="font-display text-[18px] leading-[1.1] text-[var(--theme-text)]"
            data-testid="address-name"
          >
            {address.first_name} {address.last_name}
          </p>
          {address.company && (
            <p
              className="font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text-muted)]"
              data-testid="address-company"
            >
              {address.company}
            </p>
          )}
          <div className="flex flex-col font-sans text-[14px] text-[var(--theme-text-muted)] mt-2 gap-0.5">
            <span data-testid="address-address">
              {address.address_1}
              {address.address_2 && `, ${address.address_2}`}
            </span>
            <span data-testid="address-postal-city">
              {address.postal_code}, {address.city}
            </span>
            <span data-testid="address-province-country">
              {address.province && `${address.province}, `}
              {address.country_code?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-col small:flex-row items-stretch small:items-center gap-3 mt-5 pt-4 border-t border-[var(--theme-border)]">
          <button
            className="h-11 small:h-9 px-5 rounded-none bg-hunter-gold text-hunter-dark hover:bg-hunter-gold-b transition-colors font-sans uppercase tracking-[3px] text-[12px] small:text-[11px]"
            onClick={open}
            data-testid="address-edit-button"
          >
            {t("Editează")}
          </button>
          <button
            className="small:ml-auto h-11 small:h-9 px-5 rounded-none border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-rose-500 hover:text-rose-500 transition-colors font-sans uppercase tracking-[3px] text-[12px] small:text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--theme-border)] disabled:hover:text-[var(--theme-text-muted)]"
            onClick={removeAddress}
            disabled={removing}
            data-testid="address-delete-button"
          >
            {removing ? (
              <Spinner className="w-3 h-3 animate-spin" />
            ) : (
              <Trash className="w-3 h-3" />
            )}
            {t("Șterge")}
          </button>
        </div>
        {actionError && (
          <p
            className="font-sans text-[12px] text-rose-500 mt-2"
            data-testid="address-action-error"
          >
            {actionError}
          </p>
        )}
      </div>

      <Modal isOpen={state} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <span className="font-display text-[22px] leading-[1]">
            {t("Editează adresa")}
          </span>
        </Modal.Title>
        <form key={formKey} action={formAction} className="flex flex-col flex-1 min-h-0">
          <input type="hidden" name="addressId" value={address.id} />
          <Modal.Body>
            <div className="grid grid-cols-1 gap-y-2 w-full">
              <div className="grid grid-cols-1 gap-y-2">
                <Input
                  label={t("Prenume")}
                  name="first_name"
                  required
                  autoComplete="given-name"
                  defaultValue={address.first_name || undefined}
                  enterKeyHint="next"
                  data-testid="first-name-input"
                />
                <Input
                  label={t("Nume")}
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={address.last_name || undefined}
                  enterKeyHint="next"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label={t("Companie (opțional)")}
                name="company"
                autoComplete="organization"
                defaultValue={address.company || undefined}
                enterKeyHint="next"
                data-testid="company-input"
              />
              <Input
                label={t("Adresă")}
                name="address_1"
                required
                autoComplete="address-line1"
                defaultValue={address.address_1 || undefined}
                enterKeyHint="next"
                data-testid="address-1-input"
              />
              <Input
                label={t("Apartament, etaj, etc")}
                name="address_2"
                autoComplete="address-line2"
                defaultValue={address.address_2 || undefined}
                enterKeyHint="next"
                data-testid="address-2-input"
              />
              <Input
                label={t("Cod poștal")}
                name="postal_code"
                autoComplete="postal-code"
                defaultValue={address.postal_code || undefined}
                required
                enterKeyHint="next"
                data-testid="postal-code-input"
              />
              <LocalitySelect
                countyFieldName="province"
                cityFieldName="city"
                countyValue={address.province || undefined}
                cityValue={address.city || undefined}
                required
              />
              {/* Shipping is RO-only — country is fixed, not user-facing */}
              <input
                type="hidden"
                name="country_code"
                value={address.country_code || "ro"}
              />
              <Input
                label={t("Telefon")}
                name="phone"
                type="tel"
                autoComplete="tel"
                pattern="^\+?[0-9][0-9\s\-.()]{6,16}[0-9]$"
                title={t("Introdu un număr de telefon valid")}
                required
                defaultValue={address.phone || undefined}
                data-testid="phone-input"
              />
              <label className="flex items-center gap-3 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_default_billing"
                  defaultChecked={!!address.is_default_billing}
                  className="h-4 w-4 shrink-0 accent-[var(--theme-gold)]"
                  data-testid="billing-checkbox"
                />
                <span className="font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text-muted)]">
                  {t("Folosește pentru facturare")}
                </span>
              </label>
            </div>
            {formState.error && (
              <p className="font-sans text-[12px] text-rose-500 mt-2">
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

export default EditAddress
