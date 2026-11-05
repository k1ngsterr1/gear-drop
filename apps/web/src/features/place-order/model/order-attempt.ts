import type { CheckoutInput } from '@gear-drop/contracts';

export async function getLegacyOrderKey(input: CheckoutInput) {
  try {
    const items = [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
    const fingerprint = JSON.stringify([input.email.trim().toLowerCase(), input.payment, items]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return window.sessionStorage.getItem(`gear-drop:order:${hash}`);
  } catch {
    return null;
  }
}
