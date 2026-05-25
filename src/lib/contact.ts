// Shared contact info — used by landing, onboarding, and dashboard help CTAs.
export const WHATSAPP_NUMBER = "16159180792";

export const WHATSAPP_DEFAULT_MESSAGE = `Hola 👋 / Hi 👋

Quiero información sobre InventoryFlow y cómo puede ayudar a mi negocio.

I would like information about InventoryFlow and how it can help my business.`;

export const WHATSAPP_ONBOARDING_MESSAGE = `Hola 👋 / Hi 👋

Necesito ayuda configurando mi cuenta de InventoryFlow.

I need help setting up my InventoryFlow account.`;

export function whatsappUrl(message: string = WHATSAPP_DEFAULT_MESSAGE) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Placeholder Calendly/booking URL — replace with the real booking link.
export const BOOK_DEMO_URL = "https://calendly.com/inventoryflow/onboarding";

// Optional product walkthrough video (replace with real link when available).
export const QUICK_DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export const SUPPORT_EMAIL = "support@inventoryflowapp.com";
export const SALES_EMAIL = "sales@inventoryflowapp.com";
