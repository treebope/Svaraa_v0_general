# Backend integration: handoff

Context for continuing the backend integration in a fresh clone. Written 2026-11-08 from a planning session; nothing below is implemented yet except `.env.example`.

**To a new Claude session:** read this file, CLAUDE.md, `docs/integration.md` and `.env.example`, then start at "Step 1".

## Sources (in order of trust)

1. **Live backend spec (source of truth):** `https://svaraa-backend.onrender.com/openapi.json` (docs at `/redoc`). 61 endpoints. `GET /health` and `/health/ready` both return ok (Postgres + Redis).
2. `frontend-api-contract.html` and `onboarding-api-contract-report.html` (from the backend team, in Downloads). Based on backend branch `feature/circles-and-onboarding`. **Partly out of date** (see "Live spec vs the two documents"). Still the only source for error codes and the rules below.

## Rules from the contract documents

- Base path `/api/v1`. `Authorization: Bearer <access_token>` on everything except: `/auth/otp/request`, `/auth/otp/verify`, `/auth/google`, `/auth/refresh`, `/setup-invites/lookup`, `/setup-invites/reject`, and (for now) `/chat/*`.
- Tokens: access 3 days, refresh 5 years, refresh is not rotated. Store in secure storage only, never log.
- On `401 invalid_token`: call `/auth/refresh` once (serialise: one refresh for many failed calls), retry once. If refresh fails (`invalid_token`, `session_revoked`, `user_not_found`) clear tokens and go to sign-in.
- Errors: `{"error":{"code","message","request_id","fields"?}}`. Branch on `code`, show our own i18n text, never `message`. Show `request_id` in a details link for support.
- `429 rate_limited` / `otp_cooldown`: disable the button briefly, never auto-retry in a loop. Limits are per IP.
- Phone numbers go out as `country_code` + `mobile_number`, come back masked (first 3 and last 2 visible). Masked values cannot prefill edit fields.
- Secrets in request bodies, never URLs (setup-link token, box token, invite code). Setup link and invite code are shown once.
- **No push in v0.** Refresh `GET /me/home` on app open, resume, pull-to-refresh, after every onboarding action; poll ~10 s on "waiting" screens; poll a running drill every few seconds.
- **State drives the UI:** route from the circle's `state` and `next_action`, not from what the app last did.
- Circle states: `draft → pending_consent → pending_pairing → active`, plus `declined`, `expired`, `cancelled`. `wearer_first` starts at `pending_pairing`, `caretaker_led` at `draft`. `active` = consent + verified pendant + ≥1 contact (computed). `protected_at` is set when the first drill passes.
- `next_action` values: `claim_device, enter_wearer_details, add_contact, send_setup_link, waiting_for_wearer, give_consent, pair_device, run_drill, acknowledge_drill, waiting_for_ack`, or null.
- Consent version today: `2026-11-v1`; send the version displayed (`409 consent_version_outdated` otherwise). Consent text is a placeholder until legal; for setup links render `consent_text` from the preview.
- Dev OTP is fixed `000000` (backend `ENVIRONMENT=development`, no SMS provider).
- Pairing: get nonce, pendant signs it (Ed25519 over raw nonce bytes, base64url), post signature. `requires_signature: false` units skip signing (`press_only`).

## Live spec vs the two documents (the live spec wins)

- **No owner any more.** `is_owner` is gone from circles, home and members. Permissions come only from `my_role` (`wearer`, `admin`, `viewer`). "Owner only" actions are now "wearer or admin" (invite codes, approve members, release pendant).
- **Step-up OTP:** `POST /me/step-up` sends a code to the user's own phone; send it as `otp` on: promoting/approving/demoting/removing an admin, releasing a pendant, caretaker or wearer transfer, cancelling the circle. Build one shared "Confirm with OTP" step.
- **Ownership transfer replaced:**
  - `POST /circles/{id}/caretaker-transfers` `{to_user_id, from_user_id?, keep_as_viewer, otp}`: receiver must be an active viewer, 24 h to accept via `POST /transfers/{id}/accept|decline`.
  - `POST /circles/{id}/wearer-transfers` `{country_code, mobile_number, otp}`: returns a setup link; the new wearer goes through `/setup-invites/*`; pendant goes back to unverified.
  - `POST /transfers/{id}/cancel`, `GET /me/transfers` (replaces `/me/ownership-transfers`). `/me/home` circles have `pending_transfers`.
- **New:** `POST /circles/{id}/cancel` `{otp}` ends a circle for good (state `cancelled`).
- **Changed:** remove a member is `POST /circles/{id}/members/{uid}/remove` `{otp?}` (not DELETE). Member status gains `removed`.
- Voice socket `/voice/ws` is not in the spec (OpenAPI cannot describe websockets) but exists per the documents. `/chat/` and `/chat/stream` are public.
- The spec does not list error codes; use the lists from the documents (section 7.9 of the frontend contract, ~60 codes).

## Mismatches with this app's code

1. `docs/openapi.json` only has the 9 auth/profile paths. Replace with the live spec.
2. CLAUDE.md names backend branch `feature/auth-and-user-creation`; update to the live server.
3. Mocks in `services/household/` and `services/mocks/` use `/households/...` paths that do not exist. Real: `/circles`, `/devices/claim`, `/devices/{id}/pairing/*`, `/circles/{id}/contacts`, `/circles/{id}/drills`, `/me/home`, `/me/installations`, `/setup-invites/*`.
4. Backend says "circle"/"caretaker"; CLAUDE.md forbids both in our code. Translate only in `services/household/` (a mappers file): circle → household, `caretaker_led` → caregiver-led, `caretaker_first_name` → `caregiverFirstName`. Screens never see backend words.
5. `areaOf()` in `config/flags.ts` maps `/api/v1/devices/` to `notifications`; on the backend `/devices/*` is claim/pairing (household). Notifications is `/me/installations`.

## Environment

- App `.env` / `.env.example` are written (see `.env.example`). Only `EXPO_PUBLIC_*` reaches the app; never put secrets there. Today `config/env.ts` reads only `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_USE_MOCKS`, `EXPO_PUBLIC_REAL_ENDPOINTS`; step 1 adds the rest.
- Backend env (not for the app) has `GOOGLE_CLIENT_IDS` (one ID = the Google **Web** client ID; use the same value for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) and `CORS_ORIGINS=["http://localhost:5173"]`.
- Tested: Render rejects CORS from `http://localhost:8081` (Expo web). Phones are unaffected.
- Render free tier sleeps: first request 30–60 s, hence `EXPO_PUBLIC_API_TIMEOUT_MS=60000`.

## Google sign-in plan

Native `@react-native-google-signin/google-signin` (needs a development build, not Expo Go) gives an ID token, sent to `POST /auth/google {id_token}`. Its audience is the **Web** client ID, which must be in the backend's `GOOGLE_CLIENT_IDS`. Needs: iOS client (bundle `ai.svaraa`, reversed ID as URL scheme, so move `app.json` to `app.config.ts`), Android client (package `ai.svaraa` + SHA-1 of every signing key), web origin `http://localhost:8081` in the Web client. Code: `services/auth/google.native.ts` + `google.web.ts`, then `flags.googleSignIn: 'native'`. Never a client secret in the app.

## Steps (one PR each into main; lint, typecheck, tests; update docs/integration.md)

1. **Setup:** download `openapi.json` from Render into `docs/`, `npm run api:generate`; `config/env.ts` reads all new vars; fix `areaOf()` (household: `/circles`, `/devices`, `/setup-invites`, `/member-invites`, `/transfers`, `/me/home`, `/me/pending-invites`, `/me/transfers`, `/me/step-up`; notifications: `/me/installations`; new `ai`: `/chat`); trim `services/api/pending.ts`; update CLAUDE.md contract line.
2. **Sign-in live:** `flags.auth = 'real'`; timeout and single shared refresh in `services/api/authedFetch.ts`; test with `000000`.
3. **Errors:** all codes in `services/api/errors.ts` + `i18n/en.json`, `i18n/hi.json`.
4. **Household service:** rewrite `services/household/*` to `/circles` with mappers; `useHome()` with polling; `services/notifications/notificationsApi.ts` → `POST /me/installations` (keep returned `id` as `installation_id` for pairing/verify); rewrite mocks to real paths marked `// PENDING BACKEND`; drop `is_owner`, add `pending_transfers`, `cancelled`.
5. **Wearer-first C1–C8** (services PR, then screens PR).
6. **Caregiver-led D1–D5.**
7. **Setup link D6–D8:** `services/household/setupInvites.ts`, deep link `https://svaraa.ai/j/<token>`, fallback `GET /me/pending-invites`.
8. **After setup E3–E5:** members (`/remove`), shared step-up OTP, both transfers, cancel circle, disputes, release.
9. **Google sign-in** (needs client IDs).
10. **AI chat/voice:** wait until the backend requires sign-in.

## Waiting on others

| Need | Blocks | Who |
|---|---|---|
| Confirm Render accepts OTP `000000` | Step 2 | Backend |
| Test pendant box tokens in the Render DB | Real claim (C2/D1) | Backend |
| Where wearer-first consent text/version comes from (only setup-link preview returns it) | C1 | Backend, legal |
| Add `http://localhost:8081` to `CORS_ORIGINS` on Render | Web only | Backend |
| `mobile_verified` on `GET /users/me` | Google users (workaround: react to `mobile_required`) | Backend |
| iOS + Android Google client IDs, development build | Google sign-in | Us |
| App links for `svaraa.ai/j/*` (AASA, assetlinks.json) | Opening setup link in app | Web/backend |
| Test pendant keys or keyless units | Real pairing (simulator until then) | Firmware |
| Error codes per endpoint in the spec | Nice to have | Backend |
| Sign-in on `/chat/*` and `/voice/ws`; transcript/`reply_end` frames | AI | Backend |
