# Independent Vercel deployment

The existing app selects Nitro's `vercel` target when Vercel sets `VERCEL=1`. Keep the framework preset on **Other**, the build command on `bun run build`, and leave Output Directory unset: Nitro creates `.vercel/output` with pages and server functions. Do not use a static-only SPA rewrite.

Set the browser configuration `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` to the current project's values. Set server configuration `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the same backend. Never put private keys in `VITE_*` variables.

Payments require the existing `PAYSTACK_SECRET_KEY` as a server-only secret and the deployed `/api/public/paystack-webhook` URL configured in Paystack. AI features need access to the existing AI service; Lovable's managed credential is not automatically supplied to Vercel. Do not assume transcription, quizzes, or AI tools are functional on an independent host without verifying that connection.

Google on Vercel retains the existing direct backend OAuth flow with `${window.location.origin}/auth/callback`. Allow your Vercel origin and callback in Lovable Cloud auth settings, and register the exact Google callback emitted by the authentication service with your Google Web Application client. Do not substitute the app's `/auth/callback` for Google's backend callback.

Completed email/password and Google sign-ins, and authenticated `/auth` visits, go to `/dashboard`. Signup goes there once auth returns an authenticated session; if email confirmation is enabled, account creation alone is not sign-in. Do not disable confirmation using a browser flag.

Lovable's published-site badge is managed by hosting settings, not application markup. Hiding it on Lovable requires an eligible plan. No visible Lovable branding was found in the app's own screens; do not hide injected badges using CSS or remove functioning authentication/AI integrations to strip package names.

After redeploying, verify email sign-in, signup, Google consent and return, `/auth` while signed in, dashboard hard refresh, recording/playback, and a verified Paystack payment. A local preview test is not proof of an independent production deployment.