import { Radio as RadioGroupOption } from "@headlessui/react"
import { clx } from "@modules/common/components/ui"
import React, { type JSX } from "react"

import Radio from "@modules/common/components/radio"

import { isManual } from "@lib/constants"
import PaymentTest from "../payment-test"

type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  paymentInfoMap: Record<string, { title: string; icon: JSX.Element }>
  children?: React.ReactNode
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      disabled={disabled}
      className={clx(
        "flex flex-col gap-y-2 cursor-pointer py-3 px-4 border mb-2 transition-colors duration-150",
        selectedPaymentOptionId === paymentProviderId
          ? "border-hunter-gold bg-hunter-gold/5"
          : "border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={clx(
            "w-3 h-3 rounded-full border flex-shrink-0",
            selectedPaymentOptionId === paymentProviderId
              ? "border-hunter-gold bg-hunter-gold"
              : "border-[var(--theme-border)]"
          )} />
          <span className="font-serif text-[15px] text-[var(--theme-text)]">
            {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
          </span>
          {isManual(paymentProviderId) && isDevelopment && (
            <PaymentTest className="hidden small:block" />
          )}
        </div>
        <span className="text-[var(--theme-text-muted)]">
          {paymentInfoMap[paymentProviderId]?.icon}
        </span>
      </div>
      {isManual(paymentProviderId) && isDevelopment && (
        <PaymentTest className="small:hidden text-[11px]" />
      )}
      {children}
    </RadioGroupOption>
  )
}

export default PaymentContainer