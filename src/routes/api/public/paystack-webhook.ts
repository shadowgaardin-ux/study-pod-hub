import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["PAYSTACK_SECRET_KEY"];
        if (!key) return new Response("Not configured", { status: 503 });
        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", key).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }
        const event = JSON.parse(body) as { event?: string; data?: { reference?: string } };
        if (event.event === "charge.success" && event.data?.reference) {
          const { applyPayment } = await import("@/lib/paystack.server");
          try {
            await applyPayment(event.data.reference);
          } catch (e) {
            console.error("paystack webhook", e);
            return new Response("Error", { status: 500 });
          }
        }
        return new Response("ok");
      },
    },
  },
});
