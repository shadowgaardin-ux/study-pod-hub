import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ITEMS = ["pro_monthly", "max_monthly", "pro_semester", "max_semester"] as const;

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ item: z.enum(ITEMS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { CATALOG, paystack } = await import("./paystack.server");
    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("Your account needs an email address to pay");
    const product = CATALOG[data.item];
    const origin = new URL(getRequest().url).origin;
    const tx = await paystack<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: product.amount * 100,
        currency: "NGN",
        callback_url: `${origin}/billing`,
        metadata: { user_id: context.userId, item: data.item, custom_fields: [{ display_name: "Plan", variable_name: "plan", value: product.label }] },
      }),
    });
    return { url: tx.authorization_url };
  });

export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reference: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { applyPayment } = await import("./paystack.server");
    return applyPayment(data.reference, context.userId);
  });
