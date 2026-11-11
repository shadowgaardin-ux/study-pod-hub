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