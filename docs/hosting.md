# Hosting the web version (Vercel)

The web app is a static site built by `npx expo export --platform web` into `dist/`. `vercel.json` already says how to
build it and sends every path to `index.html` (the app does its own routing).

## Set up (once)

1. Sign in at vercel.com with GitHub and choose **Add New → Project**.
2. Import `treebope/Svaraa_v0_general`. If it is not listed, give Vercel access to that repo (Configure GitHub App).
3. Leave everything as it is. Framework Preset **Other** and the build settings come from `vercel.json`.
4. Press **Deploy**. The link looks like `https://svaraa-v0-general.vercel.app`.

Every push to `main` deploys again. Every other branch gets its own preview link.

## Things to know

- The app runs on the mock backend (sample data). Sign in with a number ending in `00` (for example `9876543200`) and
  the code `000000`; any other number starts a new account.
- The session is kept in memory, so reloading the page signs you out.
- The link is public to anyone who has it. Turn on **Settings → Deployment Protection** in Vercel to limit it to your team.
- The browser cannot give Bluetooth or location, so pairing the pendant needs the phone app.
