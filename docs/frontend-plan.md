# Svaraa Core — Frontend Plan & Timeline

Nov 2, 2026 · Pragati. Source: `docs/source/frontend-plan-timeline.docx`.

## Overview

Two frontend developers build the Svaraa app for iOS, Android and web. Internal release: Jan 8, 2027.

- All 28 screens from the wireframes, in English and Hindi.
- Web: caregiver screens and the setup-link page only.
- Pendant: simulator now, real Bluetooth later, with no screen changes.
- Not now: music, news, reminders (the app is ready to add them).

|            | FE-A                                 | FE-B                                   |
| ---------- | ------------------------------------ | -------------------------------------- |
| Focus      | App, caregiver, web                  | Pendant, wearer, voice                 |
| Screens    | A1–A4, B1, B3, D1–D8, E1, E3–E5 (17) | B2, C1–C8, E2 (11)                     |
| Works with | Person 1 (login, circles, links)     | Person 2 (simulator), Person 3 (voice) |

Each person reviews the other's code.

## Tech stack

| Need                      | Tool                                                     |
| ------------------------- | -------------------------------------------------------- |
| App for iOS, Android, web | React Native + Expo (TypeScript), Expo Router            |
| Builds and updates        | EAS Build, EAS Update                                    |
| Data from backend         | TanStack Query + client generated from /openapi.json     |
| Fake backend              | MSW mocks                                                |
| App state                 | Zustand                                                  |
| English + Hindi           | i18next, Noto Sans Devanagari                            |
| Pendant                   | Simulator over WebSocket now; react-native-ble-plx later |
| Audio                     | react-native-audio-api                                   |
| QR, push, secure storage  | expo-camera, expo-notifications, expo-secure-store       |
| Google sign-in            | @react-native-google-signin                              |
| Tests                     | Jest, Maestro                                            |
| Quality and CI            | ESLint, Prettier, GitHub Actions, Sentry                 |

## App structure

```
svaraa-core/
├── app/        screens only (auth, onboarding, j/[token], main)
├── features/   auth, circles, devices, invites, consent, sos
├── services/   api, pendant, voice, push   ← all outside calls
├── ui/         design system + caregiver/wearer themes
├── i18n/       en.json, hi.json
└── config/     env, feature flags, simulator/BLE switch
```

## Rules

- Screens never call the backend, Bluetooth or WebSocket directly; only services/ does.
- Pendant uses one interface: SimulatorTransport now, BleTransport later, switched in config.
- Setup progress comes from the server, so users can resume anytime.
- No hard-coded text; every word lives in en.json and hi.json.
- Wearer screens use the large-size theme: bigger text, same buttons, same screens.
- New features (music, news) = a new folder + a feature flag.

## Working with backend

Backend agrees on each API first. Frontend lists what each screen needs; backend adds the endpoint to /docs with sample data; frontend generates code from /openapi.json and builds on mock data; backend makes it live; frontend switches from mock to real.

| Backend gives us                                   | Who      | By                            |
| -------------------------------------------------- | -------- | ----------------------------- |
| Railway URL + /docs                                | Person 4 | Week 1                        |
| interface_spec.md + simulator                      | Person 2 | Week 1–2                      |
| Login APIs                                         | Person 1 | Week 1 (draft), week 3 (live) |
| Circles, claim, consent, contacts, setup-link APIs | Person 1 | Week 2 (draft), week 4 (live) |
| Voice WebSocket format                             | Person 3 | Week 2                        |
| Push + feature-flag APIs                           | Person 4 | Week 4–5                      |

## Merging code

One repo; main is protected and always builds. Branch per ticket (`feat/FE-04-caregiver-setup`), merged within 1–2 days. Every PR reviewed by the other person, under 400 lines. CI must pass: lint, type check, tests, missing Hindi text check. Rebase on main every morning; shared folders (ui/, config/) change in small separate PRs.

## AI tool usage

Shared CLAUDE.md. Use AI for screens, tests, mock data, first-draft Hindi and PR notes. Write by hand (AI assists only): pendant/Bluetooth, background audio, login, consent and SOS.

## Tickets

| ID    | Task                                                               | Owner | Week | Days |
| ----- | ------------------------------------------------------------------ | ----- | ---- | ---- |
| FE-01 | Project setup, CI, design system, EN/HI, API client                | A     | 1–2  | 8    |
| FE-02 | Sign in + Home setup card (A1–A4)                                  | A     | 2–3  | 7    |
| FE-03 | Role choice + caregiver permission (B1, B3)                        | A     | 3    | 1    |
| FE-04 | Caregiver setup (D1–D5)                                            | A     | 3–4  | 6.5  |
| FE-05 | Setup link, deep links, web landing (D6–D8)                        | A     | 5    | 8    |
| FE-06 | Caregiver Home, circle, ownership (E1, E3–E5)                      | A     | 6    | 5.5  |
| FE-07 | Web build + Hindi review                                           | A     | 7    | 3    |
| FE-08 | Device testing + release                                           | A     | 7–9  | 2.5  |
| FE-10 | Shared components, pendant connection layer, background-audio test | B     | 1    | 7    |
| FE-11 | Permissions, about you, claim (B2, C1–C2)                          | B     | 2–3  | 6    |
| FE-12 | Pairing + pendant check (C3–C4)                                    | B     | 3–4  | 4.5  |
| FE-13 | Emergency contacts + invite (C5–C7)                                | B     | 4    | 3    |
| FE-14 | Voice relay + feature flags                                        | B     | 5    | 5    |
| FE-15 | SOS drill (C8)                                                     | B     | 5    | 2    |
| FE-16 | Background mode, push, pendant status, wearer Home (E2)            | B     | 6    | 8    |
| FE-17 | Accessibility + automated flow tests                               | B     | 7    | 3.5  |
| FE-18 | Device testing + release                                           | B     | 7–9  | 3    |

## Milestones

|     | Date   | Done when                                                 |
| --- | ------ | --------------------------------------------------------- |
| M1  | Nov 13 | API drafts + pendant spec shared; design system merged    |
| M2  | Dec 11 | Both setup paths work end to end on the simulator         |
| M3  | Dec 18 | All 28 screens done in EN + HI; push and background work  |
| M4  | Jan 8  | Tested on devices; TestFlight + Play internal builds live |

Saturday demos every week on real phones; Friday 4 pm merge stops and an EAS build goes to demo phones. Screens on mock data are labelled "demo data".

## Risks

- Backend APIs late → keep building on mock data.
- iOS stops audio when phone locks → test in week 1; fallback: voice works with app open only.
- Pendant spec keeps changing → freeze version 1 by Nov 13.
