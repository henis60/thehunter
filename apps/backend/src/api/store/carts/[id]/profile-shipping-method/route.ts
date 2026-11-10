import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { setCartProfileShippingMethodWorkflow } from "../../../../../workflows/set-cart-profile-shipping-method"

const BodySchema = z.object({
  option_id: z.string().min(1),
  data: z.record(z.unknown()).optional(),
})

/**
 * Înlocuitor pentru POST /store/carts/:id/shipping-methods care păstrează câte
 * o metodă de livrare per profil (produse obișnuite → curier eAWB, produse în
 * dropshipping → livrare gratuită fără AWB).
 *
 * POST /store/carts/:id/profile-shipping-method  { option_id, data? }
 * → { shipping_option_ids: string[] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message })
  }

  const { id } = req.params as { id: string }
  const { result } = await setCartProfileShippingMethodWorkflow(req.scope).run({
    input: {
      cart_id: id,
      option_id: parsed.data.option_id,
      data: parsed.data.data,
    },
  })

  return res.json({ shipping_option_ids: result.map((o) => o.id) })
}
