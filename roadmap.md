# App-wide premium AI style
- [x] Shared gradients/glow/shimmer, dark default, restyled buttons, cards, tags, tabs and empty states.
- [x] Consistent headers and polish on Library, Study Pods, AI Assistant, Recording, Billing, Settings and pod workspace; verify desktop/mobile and both themes.

# Compact AI dashboard
- [x] Create a one-screen AI study dashboard with a prominent recording action and animated audio visual.
- [x] Preserve recording, library, pods, assistant and billing; verify mobile/desktop, themes and recording flow.

# Midnight Focus redesign adaptation
- [x] Apply reference typography, shared surfaces and lavender/cyan/amber accents consistently without changing backend features.
- [x] Adapt dashboard and navigation to real recording, notes, pods and AI actions; remove demo-only indicators and analytics noise.
- [x] Verify signed-in navigation and study screens on desktop/mobile, both themes, reduced motion and automatic build; commit changes.

# Logo-matched polish and transcription repair
- [ ] Correct schema-specific ownership guards without changing columns or access rules; verify note updates and ownership denials.
- [x] Polish shared theme and transitions while preserving layouts; check desktop, mobile and dark mode.
- [ ] Run relevant regression tests, inspect automatic build, and report Gemini/remote deployment verification limits.

# Dashboard polish
- [x] Simplify welcome/actions, recording presentation, workspace navigation, recent activity, usage and AI entry without changing operations.
- [x] Verify signed-in desktop, mobile and dark-mode dashboard and automatic build.

# Pod workspace polish
- [x] Polish pod header and section navigation.
- [x] Improve shared-note cards, study sections and chat presentation without changing operations.
- [x] Verify signed-in workspace, invitations, notes, flashcards and chat on desktop/mobile; report any unverified flows.

# Branding and authentication
- [x] Inspect visible branding; hosted badge removal is blocked by plan eligibility.
- [x] Send completed sign-ins and authenticated /auth visits directly to the dashboard.
- [ ] Verify redirects and independent Vercel deployment; remote deployment requires updated deployment access.

# Security audit
- [x] Close membership, join-request, private-content, storage and plan privilege bypasses; verify direct API denials and Free recording quota.
- [x] Harden transcription and Paystack verification; run regression tests and verify signed-in/signed-out flows.
- [x] Report audit coverage, current build status and remaining risks in SECURITY_AUDIT.md; deep scan reviewed.
- [ ] Verify paid-plan activation and two-account pod approval lifecycle; requires approved payment test and second-account authorization.
# Colour & motion across app
- [x] Dashboard, pods, sidebar and recording panel colour/animation polish.

# First-time onboarding tour
- [x] Six-step spotlight tour (Dashboard, Record with AI, Library, Study Pods, AI Assistant, Finish) with Next/Back/Skip/progress, auto-shown once per user.
- [x] Help button to replay the tour and open the tutorial video (shown as coming soon until a video exists); verify desktop/mobile/both themes.
