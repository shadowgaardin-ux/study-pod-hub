# Study Pods Hub

Build a full-stack academic collaborative app called "Study Notes" using React + Supabase (auth, database, storage). This is a production-ready build — implement the complete layout, database schema, authentication flow, and all pages/components in this single pass.



=== APP IDENTITY & UI ===

- Clean, modern academic aesthetic: crisp typography, generous whitespace, subtle shadows, rounded corners (not overly rounded/playful)

- Full dark/light mode support with a theme toggle, persisted via localStorage

- Persistent left sidebar navigation (collapsible on mobile) with: Dashboard, My Pods, Billing, Settings, Logout

- Top bar with theme toggle, user avatar/menu, and current plan badge

- Use a consistent color system: neutral base (slate/zinc) + one accent color for primary actions

- Components should feel like a polished SaaS product — cards, modals, tabs, toasts for feedback, loading skeletons (not spinners) on data fetches



=== AUTHENTICATION ===

- Supabase Auth with:

  - Email/password signup and login

  - Google OAuth button on both signup and login forms

  - Password reset flow (forgot password link)

- Signup flow: on successful signup, automatically create a matching row in `profiles` (via trigger or client-side call) with default tier = 'Free'

- IMPORTANT — Testing mode email confirmation bypass:

  - Add a code path (env-flagged, e.g. `VITE_SKIP_EMAIL_CONFIRMATION=true`) that, when enabled, signs the user in immediately after signup without requiring email verification, and redirects straight to `/dashboard`

  - When the flag is false/absent, use Supabase's normal confirmation flow: after signup show a "Check your email" verification screen, and correctly handle the confirmation redirect link so it lands the user on `/dashboard` (not a blank page or the login screen) once confirmed

  - Handle the Supabase auth callback route/listener so OAuth and email-confirmation redirects both resolve to a valid session before routing to `/dashboard`

- Protect all authenticated routes (`/dashboard`, `/pod/:id`, `/billing`) with a route guard that redirects unauthenticated users to `/auth`



=== DATABASE SCHEMA (Supabase / Postgres) ===

Create these tables with Row Level Security (RLS) enabled and appropriate policies:



1. profiles

   - id (uuid, PK, references auth.users)

   - full_name (text)

   - avatar_url (text, nullable)

   - tier (text, enum-like check: 'Free' | 'Pro' | 'Max', default 'Free')

   - tier_expires_at (timestamptz, nullable)

   - created_at (timestamptz, default now())

   - RLS: users can select/update only their own row



2. pods

   - id (uuid, PK, default gen_random_uuid())

   - name (text)

   - course_code (text)

   - invite_code (text, unique, 6-character alphanumeric — generate on insert)

   - created_by (uuid, references profiles.id)

   - created_at (timestamptz, default now())

   - RLS: readable by members (join via pod_members); insert allowed for any authenticated user



3. pod_members

   - id (uuid, PK)

   - pod_id (uuid, references pods.id, on delete cascade)

   - user_id (uuid, references profiles.id, on delete cascade)

   - role (text, check: 'admin' | 'member', default 'member')

   - joined_at (timestamptz, default now())

   - unique constraint on (pod_id, user_id)

   - RLS: users can select rows for pods they belong to; only admins can update/delete member roles



4. notes

   - id (uuid, PK)

   - pod_id (uuid, references pods.id, on delete cascade)

   - created_by (uuid, references profiles.id)

   - title (text)

   - audio_url (text, nullable — Supabase Storage path)

   - transcript (text, nullable)

   - summary (text, nullable)

   - created_at (timestamptz, default now())

   - RLS: only pod members can select/insert; only the creator or pod admin can update/delete



5. flashcards

   - id (uuid, PK)

   - pod_id (uuid, references pods.id, on delete cascade)

   - deck_name (text)

   - front (text)

   - back (text)

   - created_by (uuid, references profiles.id)

   - created_at (timestamptz, default now())

   - RLS: pod members can select/insert; creator or admin can update/delete



6. pod_discussions

   - id (uuid, PK)

   - pod_id (uuid, references pods.id, on delete cascade)

   - user_id (uuid, references profiles.id)

   - message (text)

   - created_at (timestamptz, default now())

   - RLS: pod members can select/insert; enable Supabase Realtime on this table for live chat



Also create a Postgres function + trigger to auto-generate a unique 6-character alphanumeric `invite_code` on pod insert if not provided, and a function to auto-insert the creator into `pod_members` as 'admin' when a pod is created.



=== PAGES & ROUTES ===



/ — Landing Page

- Hero section: app name, one-line value prop ("Turn lectures into notes, flashcards, and quizzes — together"), "Get Started" CTA button linking to /auth

- Feature highlights section (3–4 cards: Study Pods, AI Transcription, Flashcards, Practice Quizzes)

- Pricing table with 3 tiers side by side:

  - Free — ₦0/mo — basic limits (e.g. 1 pod, limited notes/flashcards)

  - Pro — ₦2,500/mo — highlighted/recommended, higher limits

  - Max — ₦5,000/mo — unlimited pods, priority AI processing

  - Each tier card has a CTA button routing to /auth (or /billing if already logged in)

- Footer with basic links



/auth — Login, Signup, Verification

- Tabbed or toggle UI between "Log In" and "Sign Up"

- Signup: full name, email, password, confirm password, Google OAuth button

- Login: email, password, Google OAuth button, "Forgot password?" link

- Verification screen: shown post-signup when email confirmation is required; includes "Resend email" action

- Handle all redirect/session logic described in the Authentication section above



/dashboard — Overview

- Header: "Welcome back, [Name]" + current plan badge

- Tier usage meter: visual progress bar(s) showing usage against tier limits (e.g. pods joined, notes created this month) — pull limits from tier, pull usage from counts of related rows

- Grid/list of the user's active joined Study Pods (card per pod: name, course code, member count, "Enter Pod" button)

- "+ Create or Join Pod" button opening a modal with two tabs:

  - Create: form for pod name + course code → inserts into `pods`

  - Join: input for 6-digit invite code → looks up pod by invite_code, inserts into `pod_members`

- Empty state when user has no pods yet



/pod/:id — Group Workspace

- Pod header: name, course code, invite code (copyable), member avatars, "Invite" button

- 4 tabs:

  1. Lectures/Notes — list of notes (title, created date, creator), "+ New Note" (title + optional audio upload to Supabase Storage + transcript/summary fields), click to expand full note

  2. Flashcard Decks — grouped by deck_name, flip-card UI component, "+ New Deck" / "+ New Card" forms

  3. AI Practice Quizzes — placeholder UI ready for AI quiz generation (button "Generate Quiz from Notes", quiz-taking interface with multiple choice, score summary) — stub the generation logic with a clear TODO comment for API integration

  4. Pod Chat — real-time chat UI using Supabase Realtime subscribed to `pod_discussions` for this pod_id, message input, auto-scroll, sender name + timestamp



/billing — Plan Selector

- Current plan summary at top

- 3-column plan selector (Free / Pro ₦2,500 / Max ₦5,000) with feature comparison

- "Upgrade" button opens a modal showing selected plan, price, and a payment section clearly stubbed for Paystack/Stripe integration (placeholder "Pay with Paystack" button with a TODO comment showing where to insert the SDK/checkout call)

- On successful (stubbed) upgrade, update the user's `profiles.tier`



=== TECHNICAL NOTES ===

- Use React Router for routing

- Use Supabase client SDK for all auth/db/storage/realtime calls

- Add proper loading, empty, and error states throughout

- Add toast notifications for key actions (pod created, joined, note saved, message sent, etc.)

- Structure code cleanly into components/pages/hooks/lib folders for maintainability

- This is a real product build, not a demo — avoid placeholder Lorem Ipsum where real UX copy is expected, and make all core flows (auth, create/join pod, notes, flashcards, chat) fully functional end to end. Only the AI quiz generation and payment processing should be stubbed with clear TODOs.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f14d3e1a-46b4-426f-9c4b-67340223f021).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
