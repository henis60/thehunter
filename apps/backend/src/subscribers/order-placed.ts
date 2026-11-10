import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { capturePaymentWorkflow } from "@medusajs/core-flows";
import { runCreateOblioInvoice } from "../workflows/create-oblio-invoice";
import { resolveShippingProfileIds } from "../lib/dropshipping";

export default async function sendOrderConfirmationEmail({
  event: { data, name: eventName },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  logger.info(`Trimitere email confirmare pentru comanda: ${data.id}`);

  // Auto-capture plată la plasarea comenzii
  if (eventName === "order.placed") {
    const query = container.resolve("query")
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "payment_collections.id",
        "payment_collections.payments.id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: data.id },
    })
    const payments = orders?.[0]?.payment_collections?.flatMap((pc: any) => pc.payments ?? []) ?? []

    for (const payment of payments) {
      // `order.placed` can be redelivered (event-bus retry, replay), and a
      // second capture on an already-captured payment is an error rather than
      // a no-op — skip anything already captured or canceled.
      if (payment.captured_at) {
        logger.info(`Plată ${payment.id} deja capturată, se omite (comanda ${data.id})`)
        continue
      }
      if (payment.canceled_at) {
        logger.warn(`Plată ${payment.id} anulată, nu se capturează (comanda ${data.id})`)
        continue
      }

      try {
        await capturePaymentWorkflow(container).run({ input: { payment_id: payment.id } })
        logger.info(`Plată ${payment.id} capturată automat pentru comanda ${data.id}`)
      } catch (err) {
        // Deliberately rethrown: money not captured is worse than a delayed
        // confirmation email, and this runs *before* the email is sent, so a
        // event-bus retry re-runs cleanly (the guard above makes the capture
        // idempotent) without any risk of a duplicate email. A permanently
        // failing capture surfaces as a failed job that needs a human.
        logger.error(
          `CAPTURE FAILED: plata ${payment.id} pentru comanda ${data.id} nu a putut fi capturată — ` +
          String((err as Error)?.message ?? err)
        )
        throw err
      }
    }
  }

  try {
    const query = container.resolve("query");
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "discount_total",
        "currency_code",
        "metadata",
        "customer.first_name",
        "customer.last_name",
        "items.*",
        "items.variant.product.title",
        "items.variant.product.shipping_profile.id",
        "shipping_address.*",
      ],
      filters: { id: data.id },
    });

    if (!orders?.length) {
      logger.error(`Comanda ${data.id} negăsită, se omite emailul de confirmare`);
      return;
    }

    const order = orders[0];

    // Produsele în dropshipping vin direct de la furnizor, gratuit, în 7–10
    // zile — separat de coletul cu curier. Marcate în ambele emailuri: clientul
    // trebuie să știe că primește două colete, echipa că trebuie comandat la
    // furnizor.
    const { dropship: dropshipProfileId } = await resolveShippingProfileIds(container);
    const isDropshipItem = (item: any) =>
      !!dropshipProfileId &&
      item?.variant?.product?.shipping_profile?.id === dropshipProfileId;
    order.items = (order.items ?? []).map((item: any) => ({
      ...item,
      is_dropship: isDropshipItem(item),
    }));
    const hasDropship = order.items.some((i: any) => i.is_dropship);
    const hasCourier = order.items.some((i: any) => !i.is_dropship);

    await notifyAdmins(container, order);

    if (!order.email) {
      logger.error(`Comanda ${data.id} nu are adresă de email`);
      return;
    }

    // Generare factură Oblio (cu idempotență internă)
    let invoiceAttachment: { name: string; content: string } | null = null
    try {
      const result = await runCreateOblioInvoice(container, data.id)
      invoiceAttachment = {
        name: `factura-${order.display_id}.pdf`,
        content: result.pdf_base64,
      }
      logger.info(
        `Factură Oblio generată: ${result.series}/${result.number} pentru comanda ${data.id}`
      )
    } catch (invoiceError) {
      logger.error(
        `Eroare la generarea facturii Oblio pentru comanda ${data.id}: ` +
        String((invoiceError as Error)?.message ?? invoiceError)
      )
      // Continuăm cu trimiterea emailului chiar dacă factura a eșuat
    }

    const notificationService = container.resolve("notification");

    await notificationService.createNotifications({
      to: order.email,
      template: "5",
      channel: "email",
      data: {
        order_id: order.display_id,
        // Links to the standalone /comanda/[id] confirmation page (no login
        // required — matches the post-payment redirect), not /profil/comenzi,
        // which 404s/requires auth for guest checkouts. Mirrors
        // orderIdToSlug in apps/storefront/src/lib/util/order-slug.ts.
        order_slug: order.id.replace(/^order_/, ""),
        // Contul clientului, apoi adresa de livrare: o comandă făcută fără cont
        // (guest checkout) nu are `customer`, dar are numele pe adresă — fără
        // rezervă, emailul saluta „Mulțumim, Client." pe aproape toate comenzile.
        customer_name:
          `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim() ||
          `${order.shipping_address?.first_name ?? ""} ${order.shipping_address?.last_name ?? ""}`.trim() ||
          "Client",
        items: (order.items ?? []).map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: `${Number(item.unit_price ?? 0).toFixed(2)} ${(order.currency_code ?? "RON").toUpperCase()}`,
          subtotal: `${Number(item.subtotal ?? (item.unit_price ?? 0) * (item.quantity ?? 1)).toFixed(2)} ${(order.currency_code ?? "RON").toUpperCase()}`,
        })),
        // Text gata de afișat în șablonul Brevo (null = comandă fără dropshipping).
        // Fără „livrare gratuită”: transportul gratuit nu se menționează.
        dropship_notice: hasDropship
          ? hasCourier
            ? "Comanda ta ajunge în două colete: o parte din produse ajung în 7–10 zile, iar restul pleacă prin curier, cu cod de urmărire."
            : "Produsele din comanda ta ajung în 7–10 zile."
          : null,
        total: `${Number(order.total ?? 0).toFixed(2)} ${(order.currency_code ?? "RON").toUpperCase()}`,
        discount_total: Number(order.discount_total ?? 0) > 0
          ? `${Number(order.discount_total).toFixed(2)} ${(order.currency_code ?? "RON").toUpperCase()}`
          : null,
        shipping_address: order.shipping_address,
        storefront_url: process.env.VITE_STOREFRONT_URL,
        ...(invoiceAttachment ? { attachments: [invoiceAttachment] } : {}),
      },
    });

    logger.info(`Email confirmare trimis pentru comanda ${order.id}`);
  } catch (error) {
    // Not rethrown on purpose: `createNotifications` can fail after the
    // provider already accepted the message, so retrying would risk sending a
    // second confirmation (with a second invoice attachment) to the customer.
    logger.error(
      `Eroare la trimiterea emailului de confirmare pentru ${data.id}: ${String((error as Error)?.message ?? error)}`,
    );
  }
}

// Anunță echipa de comanda nouă: primesc toți utilizatorii din admin, citiți
// la fiecare comandă — un admin nou e inclus automat, fără redeploy. Rulează înaintea emailului către client și are propriul
// try/catch: un eșec aici nu trebuie să blocheze confirmarea clientului, și
// nici invers.
async function notifyAdmins(container: SubscriberArgs["container"], order: any) {
  const logger = container.resolve("logger");
  try {
    const recipients = await resolveAdminRecipients(container);

    if (!recipients.length) {
      logger.warn(`Niciun admin cu email găsit, se omite notificarea pentru comanda ${order.id}`);
      return;
    }

    await sendAdminNotification(container, order, recipients);
    logger.info(`Notificare comandă nouă trimisă către ${recipients.length} admin(i) pentru ${order.id}`);
  } catch (error) {
    logger.error(
      `Eroare la notificarea adminilor pentru comanda ${order.id}: ${String((error as Error)?.message ?? error)}`
    );
  }
}

async function resolveAdminRecipients(container: SubscriberArgs["container"]): Promise<string[]> {
  const query = container.resolve("query");
  const { data: users } = await query.graph({ entity: "user", fields: ["email"] });
  return [...new Set(users.map((u: any) => u.email).filter(Boolean))] as string[];
}

async function sendAdminNotification(
  container: SubscriberArgs["container"],
  order: any,
  recipients: string[]
) {
  const currency = (order.currency_code ?? "RON").toUpperCase();
  const money = (v: unknown) => `${Number(v ?? 0).toFixed(2)} ${currency}`;
  const addr = order.shipping_address ?? {};
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:9000").replace(/\/$/, "");

  const notificationService = container.resolve("notification");
  await notificationService.createNotifications(
    recipients.map((to) => ({
      to,
      template: "admin-new-order",
      channel: "email",
      data: {
        order_id: order.display_id,
        customer_name: `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim() || "—",
        customer_email: order.email ?? "—",
        customer_phone: addr.phone ?? "—",
        shipping_city: [addr.city, addr.province].filter(Boolean).join(", ") || "—",
        items: (order.items ?? []).map((item: any) => ({
          title: item.is_dropship ? `[Dropshipping] ${item.title}` : item.title,
          quantity: item.quantity,
          subtotal: money(item.subtotal ?? (item.unit_price ?? 0) * (item.quantity ?? 1)),
        })),
        total: money(order.total),
        admin_url: `${backendUrl}/app/orders/${order.id}`,
      },
    }))
  );
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
