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

  return activatePlan(reference, userId, item);
}

/**
 * Activates a verified payment. Uses the backend admin key when the host has it
 * (Lovable); otherwise (e.g. Vercel) proves itself with PAYMENT_ACTIVATION_SECRET.
 */
async function activatePlan(reference: string, userId: string, item: string) {
  type Result = { ok: true; tier: "Pro" | "Max"; already: boolean };
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("apply_verified_payment", {
      _reference: reference, _user_id: userId, _item: item,
    });
    if (error) throw new Error(activationError(error.message));
    return data as Result;
  }
  const proof = process.env["PAYMENT_ACTIVATION_SECRET"]?.trim().replace(/^["']|["']$/g, "");
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!proof || !url || !key) {
    throw new Error("Your payment was received, but plan activation isn't set up on this server (PAYMENT_ACTIVATION_SECRET missing). Your plan will activate once it is fixed — no need to pay again.");
  }
  const res = await fetch(`${url}/rest/v1/rpc/apply_verified_payment_with_proof`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ _proof: proof, _reference: reference, _user_id: userId, _item: item }),
  });
  const body = (await res.json().catch(() => null)) as (Result & { message?: string }) | null;
  if (!res.ok) throw new Error(activationError(body?.message ?? `status ${res.status}`));
  return body as Result;
}

function activationError(detail: string) {
  console.error("Plan activation failed:", detail);
  if (/not authorized/i.test(detail)) {
    return "Your payment was received, but this server's PAYMENT_ACTIVATION_SECRET doesn't match. No need to pay again — contact support with your payment reference.";
  }
  return `Your payment was received, but your plan couldn't be activated (${detail}). No need to pay again — please retry or contact support.`;
}
