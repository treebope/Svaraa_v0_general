# Svaraa Core

Expo + TypeScript (strict) + Expo Router. iOS, Android, web (caregiver screens only).
Rules for people and AI tools: [`CLAUDE.md`](CLAUDE.md). Plan: [`docs/frontend-plan.md`](docs/frontend-plan.md).

## Run

```bash
npm install
npm start        # Expo Go (scan the QR code)
npm run web      # browser
npm run start:dev # development build (after an EAS development build)
```

The first screen is the component demo (`app/(dev)/components.tsx`): every component, in both themes and both languages.
Mocks are on by default (`EXPO_PUBLIC_USE_MOCKS=true`). Demo one-time code: `000000`.

## Checks (CI runs all of them)

```bash
npm run lint && npm run typecheck && npm test && npm run i18n:check && npm run build:web
```

## Folders

| Folder      | What                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `app/`      | Screens only                                                             |
| `features/` | auth, circles, devices, invites, consent, sos, settings                  |
| `services/` | api (generated client), mocks (MSW), storage; pendant, voice, push later |
| `ui/`       | tokens, caregiver + wearer themes, components                            |
| `i18n/`     | `en.json`, `hi.json`                                                     |
| `config/`   | env, feature flags                                                       |
| `docs/`     | plan, wireframes, UI guide, source documents                             |

## API client

The client is generated from `docs/openapi.json` (the real backend). When the backend changes, replace that file and run `npm run api:generate`.

Mocks stay on until the backend URL is set. Switch single endpoints to the real server with `EXPO_PUBLIC_REAL_ENDPOINTS` (see `.env.example`). Postponed work is listed in `docs/open-items.md`.
