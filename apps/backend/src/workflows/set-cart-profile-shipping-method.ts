import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { addShippingMethodToCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  resolveProfileShippingOptionsStep,
  ResolveProfileShippingOptionsInput,
} from "./steps/resolve-profile-shipping-options"

/**
 * Setează metoda de livrare pentru profilul opțiunii alese, păstrând metodele
 * celorlalte profiluri din coș (vezi resolveProfileShippingOptionsStep).
 */
export const setCartProfileShippingMethodWorkflow = createWorkflow(
  "set-cart-profile-shipping-method",
  function (input: ResolveProfileShippingOptionsInput) {
    const options = resolveProfileShippingOptionsStep(input)

    addShippingMethodToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        options,
      },
    })

    return new WorkflowResponse(options)
  }
)

export default setCartProfileShippingMethodWorkflow
