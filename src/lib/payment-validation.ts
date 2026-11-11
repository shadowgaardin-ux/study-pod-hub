export const CATALOG = {
  pro_monthly: { tier: "Pro", months: 1, amount: 2500, label: "Pro (1 month)" },
  max_monthly: { tier: "Max", months: 1, amount: 5000, label: "Max (1 month)" },
  pro_semester: { tier: "Pro", months: 3, amount: 6000, label: "Pro Semester Pass" },
  max_semester: { tier: "Max", months: 3, amount: 12000, label: "Max Semester Pass" },
} as const;
export type CatalogItem = keyof typeof CATALOG;
export interface VerifiedTx {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: { user_id?: string; item?: string } | string | null;
}

export function validatePayment(tx: VerifiedTx, reference: string, expectedUserId?: string) {
  if (tx.reference !== reference) throw new Error("Payment reference mismatch");
  const meta = typeof tx.metadata === "object" && tx.metadata ? tx.metadata : {};
  if (!meta.item || !Object.hasOwn(CATALOG, meta.item) || !meta.user_id) throw new Error("Payment details are incomplete");
  const item = meta.item as CatalogItem;
  if (expectedUserId && meta.user_id !== expectedUserId) throw new Error("This payment belongs to another account");
  const product = CATALOG[item];
  if (tx.currency !== "NGN" || tx.amount !== product.amount * 100) throw new Error("Payment amount mismatch");
  return { item, userId: meta.user_id, product };
}