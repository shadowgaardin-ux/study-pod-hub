import { validatePayment, type VerifiedTx } from "./payment-validation";
export { CATALOG } from "./payment-validation";
export type { CatalogItem } from "./payment-validation";

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

/** Verifies a reference with Paystack and upgrades the buyer once. */
export async function applyPayment(reference: string, expectedUserId?: string) {
  const tx = await paystack<VerifiedTx>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== "success") return { ok: false as const, status: tx.status };
  const { item, userId } = validatePayment(tx, reference, expectedUserId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("apply_verified_payment", {
    _reference: reference, _user_id: userId, _item: item,
  });
  if (error) throw new Error(error.message);
  return data as { ok: true; tier: "Pro" | "Max"; already: boolean };
}
