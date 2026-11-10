# Connecting the app to the real backend

For the person who connects the app to the server. Simple steps, no coding knowledge needed beyond editing a file.

## What is mock vs real

**Mock** means the app answers itself with made-up data, so we can build screens before the server exists.
**Real** means the app talks to the real Svaraa server.

## Status of each area

| Screen                    | What it needs                                                                         | Service file                                 | Switch                | Status      |
| ------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------- | ----------- |
| A1, A2 Sign in (phone)    | Send code, check code, refresh, sign out                                              | `services/auth/authApi.ts`                   | `flags.auth`          | Draft ready |
| A1 Sign in (Google)       | Google token, then `/auth/google`                                                     | `services/auth/authApi.ts`                   | `flags.googleSignIn`  | Mock        |
| A2 Add your phone         | `/auth/mobile/request`, `/mobile/verify`                                              | `services/auth/authApi.ts`                   | `flags.auth`          | Draft ready |
| A4 Home (name)            | `GET` and `PATCH /users/me`                                                           | `services/auth/authApi.ts`                   | `flags.auth`          | Draft ready |
| News (top 5)              | `GET /news/{region}` (world, IN, US, CA): top five stories found by an AI search      | `services/news/newsApi.ts`                   | (mock only)           | Mock        |
| B1 Who are you?           | `POST /households` (not in the API yet)                                               | `services/household/householdApi.ts`         | `flags.household`     | Mock        |
| B3 Caregiver alerts       | `POST /devices/push-token` (not in API)                                               | `services/notifications/notificationsApi.ts` | `flags.notifications` | Mock        |
| B2 Wearer permissions     | `POST /devices/push-token` (not in API)                                               | `services/notifications/notificationsApi.ts` | `flags.notifications` | Mock        |
| C1 About you + consent    | `PATCH /households/{id}/wearer`, `POST /households/{id}/consent` (not in API)         | `services/household/wearerApi.ts`            | `flags.household`     | Mock        |
| C2 Claim pendant          | `POST /households/{id}/claim` (not in API)                                            | `services/household/wearerApi.ts`            | `flags.household`     | Mock        |
| C3 Pair pendant           | `POST /households/{id}/devices/{device_id}/challenge`, `.../activate` (not in API)    | `services/household/wearerApi.ts`            | `flags.household`     | Mock        |
| C5, C6 Emergency contacts | `PUT /households/{id}/contacts` (not in API)                                          | `services/household/wearerApi.ts`            | `flags.household`     | Mock        |
| C7 Invite a caregiver     | `POST /households/{id}/invites` (not in API)                                          | `services/household/wearerApi.ts`            | `flags.household`     | Mock        |
| C8 SOS drill              | `POST /households/{id}/drills`, `GET /households/{id}/drills/{drill_id}` (not in API) | `services/household/wearerApi.ts`            | `flags.household`     | Mock        |

"Draft ready" means the endpoint exists in `docs/openapi.json` and the app already calls it the right way. It has not been tried against the live server.
"Live" means it has been tried on a phone against the real server. Nothing is Live yet.

## How to connect one area to the real backend

1. Get the server address (the Railway URL). Open the file `.env` (copy `.env.example` to `.env` if it is missing).
2. Set the address in `.env`: `EXPO_PUBLIC_API_URL=https://your-server-address` (no `/api/v1` at the end).
3. Open `config/flags.ts`. Change that area's switch from `'mock'` to `'real'`, for example `auth: 'real'`.
4. If the endpoint is marked `PENDING BACKEND` (`services/api/pending.ts`): check that the server now has it. Run `npm run api:generate`, then delete that endpoint from `services/api/pending.ts`.
5. Restart the app: `npx expo start --clear`.
6. Walk through the screens in the table above and check them (see "How to check it worked"). Then change the Status in the table.

## Worked example: connect phone sign-in

1. In `.env`, set `EXPO_PUBLIC_API_URL=https://your-server-address`.
2. In `config/flags.ts`, change `auth: 'mock'` to `auth: 'real'`. This switches all of sign-in, refresh, sign out and `/users/me` together. Leave `household` and `notifications` as `'mock'`.
3. Make sure the server accepts the test code `000000` (the dev server does).
4. Run `npx expo start --clear` and open the app in Expo Go.
5. Follow "How to check it worked" below.
6. In the table above, change the Status of the sign-in rows to `Live`. Commit as `docs(FE-XX): mark sign-in live`.

## How to check it worked

Phone sign-in:

1. Open the app. You see the welcome screen. Tap the phone sign-in button.
2. Enter a mobile number and tap Continue. You should see the code screen. (A real error here shows our own message, never server text.)
3. Enter `000000`. You should land on the intro (new number) or Home (existing number).
4. Close the app fully and open it again. You should still be signed in.
5. Open Profile and tap Sign out. You should be back on the welcome screen.

Household (B1): on Home, tap the setup card, choose "I'm a caregiver", tap Continue. You should reach "Stay informed".
Notifications (B3): tap Allow notifications and accept. You should move on. If you tap "Don't allow", you should see "Open settings".
Wearer basics (C1): fill in a name, tick the agreement, tap Continue. You should reach "Scan the code in the box".
Pairing (C3, C4) uses the pendant simulator (`flags.pendantTransport = 'simulator'`): tap "I pressed the dot", then Pair, then tick the three checks.
SOS drill (C8): tap "Run SOS drill". The mock's first emergency contact answers after 6 seconds.
Claim (C2): tap "Enter code instead" and type a code in the shape `SVRA-2041-7K3P` (mock: any such code works; one ending in `-0000` is "already claimed").

## If something breaks

1. **"No connection" or "Something went wrong" on every screen.** The app cannot reach the server. Check `EXPO_PUBLIC_API_URL` (no typo, no `/api/v1`), that the server is running, then restart with `npx expo start --clear`. On the web build, the server must also allow our address (this is called CORS) in its settings.
2. **The code screen says "Wrong or expired code".** The server did not accept the code. The dev server only accepts `000000`. Request a new code and try again.
3. **You are sent back to the welcome screen again and again.** The server rejects the saved sign-in (`invalid_token` or `session_revoked`). Sign in again. If it keeps happening, check that the app and the server use the same environment (a token from one server does not work on another).
