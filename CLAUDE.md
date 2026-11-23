# Svaraa Core

Expo + TypeScript (strict) + Expo Router. iOS, Android, web (caregiver screens only).

Read docs/frontend-plan.md first. Screens in docs/svaraa-wireframes.html. Brand in docs/ui-guide/.

## Rules

- app/ = screens only. All API, pendant, voice and storage calls go through services/.
- No hard-coded text: every string in i18n/en.json and i18n/hi.json.
- Two themes: caregiver and wearer (larger text only; button size is the same in both).
- Naming: always "caregiver" (never "caretaker") and "household" (never "circle") in code, i18n and docs.
- Buttons and tap targets are the same size in the caregiver and wearer themes; only text size differs.
- API: docs/openapi.json is the contract (real backend, branch feature/auth-and-user-creation). After it changes, run `npm run api:generate`.
- Errors: map them in services/api/errors.ts using the real lowercase codes (`invalid_otp`, `otp_cooldown`, ...). Show our own i18n text for a code, never server text.
- Server state: TanStack Query. App state: Zustand. Mocks: routes in services/mocks/routes.ts (MSW on web, a fetch mock on phone), switched to the real backend per endpoint with EXPO_PUBLIC_REAL_ENDPOINTS.
- API work changes only services/, config/flags.ts and mocks, never screens. One service folder per area (services/auth/, services/household/, services/notifications/), one switch per area in config/flags.ts ('mock' or 'real'), and every mocked endpoint is marked `// PENDING BACKEND`. Keep the status table in docs/integration.md up to date in every PR.
- Anything with no backend yet is mocked and marked "pending backend" in a comment.
- Mobile-only code in .native.ts, with a .web.ts stub.
- Small commits; run lint, typecheck and tests before finishing.
- Check docs/open-items.md before finishing a feature; add anything postponed there.

## Git and pull requests

- Branch names: `type/FE-XX-short-name` (types: feat, fix, chore, refactor, test, docs), e.g. `feat/FE-02-sign-in`. `main` is the only other allowed name. Checked by the pre-push hook.
- Commit messages: `type(FE-XX): message`, e.g. `feat(FE-02): add phone sign-in`. The ticket ID is required. Checked by the commit-msg hook (commitlint).
- One PR per ticket into `main`, using `.github/pull_request_template.md` (Ticket, What changed, Screenshots EN + HI, Mocked / pending backend, Checklist).
- Never skip the hooks (`--no-verify`). Full rules: CONTRIBUTING.md.
