export const PRODUCT_CATEGORIES = [
  "Auto Parts",
  "Detailing Products",
  "Warehouse Supplies",
  "Beauty Supply",
  "Electronics",
  "Tools",
  "Office Supplies",
  "Food & Beverage",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
