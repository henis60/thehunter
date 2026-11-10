"use client"

import { useTranslations } from "next-intl"
import { useActionState, useEffect, useState } from "react"

import { updateCustomerProfile } from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { HttpTypes } from "@medusajs/types"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"

type ProfileDetailsProps = {
  customer: HttpTypes.StoreCustomer
}

const Row = ({
  label,
  value,
  testId,
}: {
  label: string
  value: string
  testId?: string
}) => (
  <div className="py-5 flex flex-col gap-1">
    <span className="font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
      {label}
    </span>
    <span
      className="font-serif text-[17px] text-[var(--theme-text)]"
      data-testid={testId}
    >
      {value}
    </span>
  </div>
)

const ProfileDetails = ({ customer }: ProfileDetailsProps) => {
  const t = useTranslations("account")
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)
  // See add-address.tsx: forces the form (and its Inputs' inline error
  // state) to remount fresh on reopen instead of surviving a native reset.
  const [formKey, setFormKey] = useState(0)

  const [formState, formAction] = useActionState(updateCustomerProfile, {
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
    <div data-testid="profile-details">
      <div className="flex flex-col divide-y divide-[var(--theme-border)]">
        <Row
          label={t("Nume")}
          value={
            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
            "—"
          }
          testId="profile-name"
        />
        <Row
          label={t("Adresă de email")}
          value={customer.email}
          testId="profile-email"
        />
        <Row
          label={t("Număr de telefon")}
          value={customer.phone || "—"}
          testId="profile-phone"
        />
      </div>

      <div className="mt-1 pt-5 border-t border-[var(--theme-border)]">
        <button
          className="w-full small:w-auto h-12 small:px-8 bg-hunter-gold text-hunter-dark hover:bg-hunter-gold/90 transition-colors font-sans uppercase tracking-[3px] text-[13px]"
          onClick={open}
          data-testid="profile-edit-button"
        >
          {t("Editează")}
        </button>
      </div>

      <Modal isOpen={state} close={close} data-testid="edit-profile-modal">
        <Modal.Title>
          <span className="font-display text-[22px] leading-[1]">
            {t("Editează detaliile")}
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
                  defaultValue={customer.first_name ?? ""}
                  enterKeyHint="next"
                  data-testid="first-name-input"
                />
                <Input
                  label={t("Nume")}
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={customer.last_name ?? ""}
                  enterKeyHint="next"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label={t("Telefon")}
                name="phone"
                type="tel"
                autoComplete="tel"
                pattern="^\+?[0-9][0-9\s\-.()]{6,16}[0-9]$"
                title={t("Introdu un număr de telefon valid")}
                defaultValue={customer.phone ?? ""}
                data-testid="phone-input"
              />
              <p className="font-sans text-[12px] text-[var(--theme-text-muted)] mt-1">
                {t("Adresa de email nu poate fi modificată")}
              </p>
            </div>
            {formState.error && (
              <p
                className="font-sans text-[12px] text-rose-500 mt-2"
                data-testid="profile-error"
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
    </div>
  )
}

export default ProfileDetails
