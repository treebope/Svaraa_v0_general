# Svaraa UI Guide

The visual and component rules for the Svaraa web app. Written from the V0 code, so it matches what ships.
Source of truth: `packages/ui/src/tokens/tokens.css` (tokens) and `packages/ui/src/components/` (components).
Live view of every component and state: `/styleguide` (add `?theme=dark` for dark mode).

## 1. Principles

- **Calm and warm.** Cream canvas, plum primary, soft glass cards, soft colour glows behind the page.
- **One primary action per view.** Red is only for safety.
- **Always a word.** Status is never colour alone. Chips, tags and badges carry a label or icon.
- **Large and readable.** Body text is 16 px or more. Tap targets are 40 px or more (48 px for main actions).
- **Same four screens everywhere:** loading, empty, error, pendant not connected.
- **Light and dark themes** with the same token names.

## 2. Using the tokens

Set `data-theme="light"` or `data-theme="dark"` on `<html>`. Never hard-code a colour in a page: use a token.
Token names are stable. Some are named `aubergine-*` for compatibility, but the hues are the website's plum.

### Colour roles (light / dark)

| Role                   | Token                                 | Light         | Dark                 |
| ---------------------- | ------------------------------------- | ------------- | -------------------- |
| Page background        | `--bg-canvas`                         | `#fbf7f2`     | `#18171a`            |
| Card (glass)           | `--bg-surface`                        | white 78%     | `rgba(40,38,43,.85)` |
| Solid card             | `--bg-surface-solid`                  | `#ffffff`     | `#242227`            |
| Sunken area            | `--bg-sunken`                         | plum 6%       | black 28%            |
| Brand block            | `--bg-brand`                          | `#4a1532`     | `#4a1532`            |
| Body text              | `--text-primary`                      | `#3a3340`     | `#e9e3dc`            |
| Secondary text         | `--text-secondary`                    | `#6b6474`     | `#b3aab3`            |
| Tertiary text          | `--text-tertiary`                     | `#7b7483`     | `#928a95`            |
| Headings               | `--text-heading`                      | `#4a1532`     | `#f5efe7`            |
| Primary action         | `--action-primary`                    | `#6f1d47`     | `#e2bd72` (gold)     |
| Text on primary        | `--action-on-primary`                 | `#fff8f2`     | `#22180c`            |
| Memory accent          | `--accent-memory`                     | `#c8505b`     | `#e8a0a6`            |
| Spirit accent / kicker | `--accent-spirit`                     | `#b88a44`     | `#d9b065`            |
| Heading italic         | `--accent-italic`                     | `#c8505b`     | `#e6bf74`            |
| Focus ring             | `--focus-ring`                        | `#6f1d47`     | `#e2bd72`            |
| Borders                | `--border-default`, `--border-subtle` | plum 16% / 8% | white 14% / 7%       |

### Status colours

Each has a strong colour and a `-tint` background. Use the pair together.

| Meaning   | Token                | Use                                              |
| --------- | -------------------- | ------------------------------------------------ |
| Good      | `--status-good`      | Connected, verified, done                        |
| Attention | `--status-attention` | Low battery, late, needs a look                  |
| Safety    | `--status-safety`    | SOS, fall, recording, long offline               |
| Info      | `--status-info`      | Neutral notices                                  |
| Solid red | `--danger-solid`     | The safety button and safety banner (white text) |

### Scales and tile families

- Scales: `--aubergine-50…950`, `--rose-100/300/500/700`, `--lotus-gold-100/300/500/700`, `--cream-50…300`, `--ink-100…900`, `--world-100/300/500`.
- Tile gradients by family: `care` (plum), `memory` (rose), `spirit` (gold), `world` (blue), `home` (cream; quiet in dark), `safety` (red).

### Type

| Use        | Token            | Font                                  | Size / line |
| ---------- | ---------------- | ------------------------------------- | ----------- |
| Display    | `--type-display` | Newsreader 400                        | 44 / 52     |
| Title 1    | `--type-title-1` | Newsreader 400                        | 34 / 42     |
| Title 2    | `--type-title-2` | Newsreader 400                        | 26 / 34     |
| Heading    | `--type-heading` | Inter 600                             | 18 / 24     |
| Body large | `--type-body-lg` | Inter 400                             | 18 / 28     |
| Body       | `--type-body`    | Inter 400                             | 16 / 24     |
| Body small | `--type-body-sm` | Inter 400                             | 14 / 20     |
| Label      | `--type-label`   | Inter 500                             | 14 / 20     |
| Caption    | `--type-caption` | Inter 400                             | 12 / 16     |
| Kicker     | `--type-kicker`  | Inter 500, 0.32em tracking, uppercase | 12 / 16     |

**App type scale (mobile, `ui/tokens.ts`).** The app uses one step smaller than the web sizes above, for a compact, professional look: display 32/40, title 1 26/32, title 2 21/28, heading 16/22, body large 16/24, body 15/22, body small 13/18, label 14/20, caption 12/16, kicker 11/14 (1.2 tracking). The wearer theme multiplies text by 1.1; button heights and tap targets stay the same in both themes.

- `h1`–`h3` use Newsreader and `--text-heading` automatically.
- One italic phrase in a heading takes the accent colour: `<h1>A World of Care, <em>Just a Word Away.</em></h1>`.
- Small gold label above a heading: class `sv-kicker`.
- Indic text uses `--font-indic` (Noto Sans, Devanagari and Tamil are loaded in `apps/web/index.html`).
- Fluid sizes for the shell: `--font-size-ui`, `--font-size-display`, `--font-size-title`, `--font-size-body`.

### Space, radius, shadow, motion

- Space: `--space-1…8` = 4, 8, 12, 16, 24, 32, 48, 64 px.
- Radius: `--radius-sm` 8, `-md` 12, `-lg` 16, `-xl` 24, `-2xl` 28, `-tile` 26%, `-full` 999.
- Shadow: `--shadow-1` (cards), `--shadow-2` (raised), `--shadow-3` (dialogs).
- Glass: `--bg-glass`, `--bg-glass-strong`, `--glass-border`, `--glass-blur`.
- Motion: `--motion-quick` 120 ms, `-standard` 200 ms, `-gentle` 320 ms; `--ease-enter`, `--ease-exit`. Under `prefers-reduced-motion` all collapse to 120 ms and animations stop.
- Layout: `--page-pad-x/y`, `--shell-gap`, `--shell-max` (1440 px), `--tile-size`, `--safe-*` (device safe areas), `--app-height` (100dvh).

## 3. Components (`@svaraa/ui`)

All are exported from `packages/ui/src/index.ts`. Styles are in `components/components.css` (`sv-*` classes).

| Component                                                         | Purpose                                                                            | Key props                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Button`                                                          | Actions                                                                            | `variant`: primary, secondary, tertiary, safety. `size`: sm 32, md 40, lg 48, xl 64 px              |
| `Input`                                                           | Text field with label, hint, error                                                 | `label`, `hint`, `error`, `hideLabel`                                                               |
| `OtpField`                                                        | Email or phone verified by one-time code                                           | `onSend`, `onVerify` (the page supplies them; no backend calls inside)                              |
| `Toggle`, `Checkbox`, `SegmentedControl`                          | Controls                                                                           | `checked`, `onChange`, `label`                                                                      |
| `PendantChip`                                                     | Top-bar pendant status                                                             | `state`: connected, charging, low, not_connected, recording, mics_off; `battery`, `since` (minutes) |
| `SyncChip`                                                        | On anything sent to the pendant                                                    | `state`: waiting, sent, synced                                                                      |
| `Tag`, `Badge`                                                    | Small label, count badge (9+) or safety ring                                       | `tone`                                                                                              |
| `AttentionCard`                                                   | One problem, one card, one primary action                                          | `title`, `detail`, `cta`, `severity`                                                                |
| `SurfaceCard`                                                     | Standard glass card                                                                |                                                                                                     |
| `Banner`                                                          | Top-of-window notice                                                               | `tone`: neutral, attention, good, info, safety                                                      |
| `Tile`                                                            | App tile, squircle with family gradient                                            | `family`, `icon`, `label`, `count`, `safetyRing`                                                    |
| `StepRail`                                                        | Setup progress, done steps revisitable, later steps locked                         | `Step`: `id`, `label`, `done`, `locked`                                                             |
| `Dialog`                                                          | Modal; Esc and scrim close, focus moves in and returns                             | `open`, `title`, `onClose`, `actions`                                                               |
| `Toast`                                                           | `ToastProvider` once, then `useToast()(message, tone)`; auto-dismiss 5 s           |                                                                                                     |
| `ChatBubble`, `ChatThinking`, `ProposalCard`                      | Companion chat. Do-mode proposals wait for OK                                      | `ProposalState`: needs_ok, working, done, cancelled                                                 |
| `LoadingState`, `EmptyState`, `ErrorState`, `PendantOfflineState` | The four standard screens                                                          |                                                                                                     |
| `AppShell`                                                        | Top bar (logo, tabs, search, bell, pendant chip, avatar), companion panel, content | `pendantState`, `tabs`, `companion`                                                                 |
| `LotusMark`                                                       | Logo; light and dark images from `apps/web/public/brand/`                          | `size` (height px)                                                                                  |

### Rules of use

- One `primary` Button per view. `safety` only for safety actions.
- Pendant offline: grey, amber after 30 min, red after 2 h. Recording is always red.
- Anything sent to the pendant shows a `SyncChip`.
- Safety banners pin above everything until acknowledged. An `AttentionCard` clears when its state clears, not by dismissal alone.
- Do-mode actions are shown in a `ProposalCard`; nothing runs until the person approves. Mark results the backend does not produce yet with `simulated`.

## 4. Accessibility

- Visible focus ring on every control (`:focus-visible`, 2 px, `--focus-ring`).
- Inputs link their hint or error with `aria-describedby`; errors use `role="alert"`.
- Toggles use `role="switch"`; the step rail marks the current step with `aria-current="step"`.
- Hidden-but-readable text uses `sv-sr-only`.
- Status never relies on colour alone.

## 5. Responsive behaviour

- Fluid page padding and font sizes via `clamp()` tokens.
- App shell: single column below 900 px, shell with companion panel from 900 px, wider layout from 1400 px.
- Respect device safe areas (`--safe-*`) and `100dvh`.

## 6. Look history

The V0 look follows the Svaraa website (Newsreader + Inter, plum, soft glow). The earlier Brand-document values
are kept in `docs/design/tokens.brand-doc-v1.css`. Token names did not change between the two.

## 7. Adding to the UI

1. Use tokens only. Add a new token to `tokens.css` (both themes) rather than a literal.
2. Put reusable pieces in `packages/ui`, page-specific styling in `apps/web/src/styles/app.css`.
3. Add the component and its states to `StyleguidePage.tsx` and a test beside the component.
4. Check light and dark, 360 px width, keyboard, and reduced motion.
