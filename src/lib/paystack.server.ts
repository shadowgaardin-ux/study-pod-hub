export const CATALOG = {
  pro_monthly: { tier: "Pro", months: 1, amount: 2500, label: "Pro (1 month)" },
  max_monthly: { tier: "Max", months: 1, amount: 5000, label: "Max (1 month)" },
  pro_semester: { tier: "Pro", months: 3, amount: 6000, label: "Pro Semester Pass" },
  max_semester: { tier: "Max", months: 3, amount: 12000, label: "Max Semester Pass" },
} as const;
export type CatalogItem = keyof typeof CATALOG;

export function paystackKey() {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Payments are not set up yet");
  return key;
}

export async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json" },
  });
  const body = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) throw new Error(body.message || "Payment provider error");
  return body.data;
}

interface VerifiedTx {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: { user_id?: string; item?: string } | string | null;
}

/** Verifies a reference with Paystack and upgrades the buyer once. */
export async function applyPayment(reference: string, expectedUserId?: string) {
  const tx = await paystack<VerifiedTx>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== "success") return { ok: false as const, status: tx.status };
  const meta = typeof tx.metadata === "object" && tx.metadata ? tx.metadata : {};
  const item = meta.item as CatalogItem | undefined;
  const userId = meta.user_id;
  if (!item || !(item in CATALOG) || !userId) throw new Error("Payment details are incomplete");
  if (expectedUserId && userId !== expectedUserId) throw new Error("This payment belongs to another account");
  const product = CATALOG[item];
  if (tx.currency !== "NGN" || tx.amount < product.amount * 100) throw new Error("Payment amount mismatch");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    reference, user_id: userId, item, tier: product.tier, months: product.months, amount: product.amount,
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: true as const, tier: product.tier, already: true };
    throw new Error(insertError.message);
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("tier, tier_expires_at").eq("id", userId).maybeSingle();
  const now = Date.now();
  const current = profile?.tier_expires_at ? new Date(profile.tier_expires_at).getTime() : 0;
  const base = profile?.tier === product.tier && current > now ? current : now;
  const expires = new Date(base);
  expires.setMonth(expires.getMonth() + product.months);
  const { error } = await supabaseAdmin
    .from("profiles").update({ tier: product.tier, tier_expires_at: expires.toISOString() }).eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true as const, tier: product.tier, already: false };
}
