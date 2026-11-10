// Shared text-role classes for the checkout steps (address/shipping/payment/
// review). Kept as plain className strings — consistent with how the rest of
// the storefront applies Tailwind — rather than wrapper components, so they
// drop into existing spans/divs without changing markup structure.

// Step section title (e.g. "Livrare", "Plată"). Matches the small-caps
// "eyebrow" label used sitewide (product page category link, tab row
// labels): font-sans, uppercase, wide tracking, muted — never bold or full
// text color. Emphasis on the site always comes from font-display headings,
// not from bolding a label.
export const sectionTitleClass =
  "font-sans text-[11px] uppercase tracking-[5px] text-[var(--theme-text-muted)]"

// "Modifică" / edit-step action link.
export const editLinkClass =
  "font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"

// Small caption above a value in the collapsed/summary state (e.g. "Metodă").
export const fieldLabelClass =
  "font-sans text-[9px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-1 block"

// The actual information the user needs to read (selected address, shipping
// method name, provider name) — full text color (not muted) so it reads as
// primary content, but otherwise the same serif-italic voice used for body
// copy sitewide (product subtitle, etc).
export const bodyTextClass = "font-serif italic text-[15px] text-[var(--theme-text)]"

// Secondary/supporting copy (empty states, helper text, disabled explanations).
export const bodyMutedClass = "font-serif italic text-[14px] text-[var(--theme-text-muted)]"

// Prices/amounts — hunter-gold, matching the site's rule that gold is
// reserved for price/accent/CTA (see product-price, add-to-cart button).
export const priceTextClass = "font-serif text-[16px] text-hunter-gold"

// Main step submit button — same treatment as the product page's "Add to
// Cart" button (product-actions), for a consistent primary CTA sitewide.
export const ctaButtonClass =
  "w-full h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent hover:!bg-hunter-gold-b font-sans uppercase tracking-[3px] text-[12px] transition-colors disabled:!bg-[var(--theme-surface)] disabled:!text-[var(--theme-text-muted)]"
