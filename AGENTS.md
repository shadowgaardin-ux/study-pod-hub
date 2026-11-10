<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Payments use Paystack via server functions (src/lib/payments.functions.ts) plus a signed webhook at /api/public/paystack-webhook; plans are only changed server-side after verification — naira support, no Lovable paid-plan requirement.
- Keep pod workspace presentation in its existing route and tab components, reusing the same queries and mutation handlers so visual updates do not alter access or data contracts.
- Use the shared post-auth destination for completed email and Google sign-ins, so auth redirects remain consistent.
- Select Nitro's Vercel preset only when VERCEL=1, preserving the existing Lovable deployment target elsewhere.
