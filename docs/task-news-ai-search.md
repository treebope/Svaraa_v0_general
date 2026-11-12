# Task: News "Top 5" through AI search (backend)

**Ticket:** FE-07 (frontend done, backend needed) · **Owner:** backend developer · **Size:** about 2 to 3 days including tests

## What and why

The app has a **News** tile in Apps. The person picks **World wide, India, US or Canada** and sees the **top 5 news stories** for that region. The stories must be found with an **AI search** (a language model that can search the web), not a fixed news feed.

The screen is finished and runs on made-up "Sample:" headlines from `services/mocks/news.ts`. Your job is to build the real endpoint so those samples can be removed. **No app code has to change**, apart from one error code (step 8).

The AI search must run on the **server**. The app must never hold an API key, and one person opening the screen must not start a search of its own.

## The endpoint to build

`GET /api/v1/news/{region}`, where `region` is one of `world`, `IN`, `US`, `CA`.

Auth: same as the other `/api/v1` endpoints (signed-in user).

Response `200`:

```json
{
  "region": "IN",
  "generated_at": "2026-11-10T14:05:00Z",
  "items": [
    {
      "id": "IN-1",
      "rank": 1,
      "title": "Short, plain headline",
      "summary": "Two or three plain sentences about the story.",
      "source": "Name of the publisher",
      "url": "https://publisher.example/story",
      "published_at": "2026-11-10T11:30:00Z"
    }
  ]
}
```

Rules for the response:

- Exactly **5** items, `rank` 1 to 5, most important first.
- `title` and `summary` are in the language the app is set to. Read it from `Accept-Language` (`en` or `hi`).
- `url` is the real link to the original story, opened by the app when tapped. Never invent a link.
- Types are in `services/api/pending.ts` (`NewsOut`, `NewsItem`, `NewsRegion`). Keep the JSON identical.

Errors (same shape as the other endpoints, lowercase codes):

- `404 region_not_found` for any other region.
- `503 news_unavailable` when the search or the model fails and there is no cached copy to fall back on.

## Steps to build

1. **Add the route** `GET /api/v1/news/{region}` and validate `region`.
2. **Add the endpoint to `docs/openapi.json`** and tell the frontend, who then runs `npm run api:generate` and moves the types out of `services/api/pending.ts`.
3. **Call an AI model with web search.** Use the Anthropic API (Claude) with its web search tool turned on. Check the current Anthropic docs for the exact tool type and model name. Keep the API key in the server's environment (for example `ANTHROPIC_API_KEY`), never in git and never sent to the app.
4. **Write the prompt** (keep it in one file, so it is easy to tune). It should ask for:
   - the 5 most important and widely reported stories **from the last 24 hours** for the region;
   - for `world`, global stories; for `IN`, `US`, `CA`, stories that matter to people in that country;
   - reliable, mainstream sources, and each story from a different publisher where possible;
   - calm, factual wording with no sensational language, because the readers are older adults;
   - a two or three sentence summary in the requested language;
   - the real URL and the publisher's name for every story, taken from the search results;
   - output as JSON only, matching the response above.
5. **Check the model's answer before returning it.** Parse the JSON and reject the answer if it is not valid, has fewer than 5 items, or has a `url` that is not a real `https` link. Retry once, then fall back (step 6). Never return an answer you could not parse.
6. **Cache it.** Store the result per `region` and language for about **15 minutes** (Redis, the database or memory, whatever the backend already uses). Opening the screen should read the cache. Only one search per region per language per 15 minutes, however many people open it. If a refresh fails, serve the previous cached copy (even if older) rather than an error.
7. **Protect the cost.** Rate-limit the endpoint per user, set a timeout on the model call (about 30 seconds), and cap the number of searches per day with an alert when it is close.
8. **Frontend error code.** Tell the frontend to add `news_unavailable` and `region_not_found` to `services/api/errors.ts` with i18n text in English and Hindi, so the app shows our own message and not server text.
9. **Switch the app to the real endpoint.** The frontend changes the news area in `config/flags.ts` from `'mock'` to `'real'` (see `docs/integration.md`) and removes `services/mocks/news.ts`.

## Acceptance checklist

- [ ] All four regions return 5 valid items in English and in Hindi.
- [ ] Every `url` opens the real original story.
- [ ] A second request within 15 minutes does not call the AI model (check the logs).
- [ ] If the AI call fails, the app gets the cached copy, or `503 news_unavailable` if there is none.
- [ ] The API key appears nowhere in the app, the repo or the logs.
- [ ] A test covers: valid answer, malformed answer (rejected), fewer than 5 items (rejected), cache hit, model failure.
- [ ] The endpoint is in `docs/openapi.json` and the status row in `docs/integration.md` says Real.

## Things to be careful about

- **Accuracy.** An AI can summarise a story wrongly. Keep the summaries short and always keep the link to the original. The app footer already says the stories are found with AI search.
- **Sensitive stories.** The readers are older adults, some alone. Consider asking the model to avoid graphic content in the summary, and agree the wording with the product owner.
- **Privacy.** Send only the region and language to the model. No user name, number or other personal details.
- **Staleness.** Show `generated_at` honestly; the app already displays it.

## Open questions for the product owner

1. Should the region default to the person's country instead of World wide?
2. Should the pendant read the news aloud? (A later task.)
3. Which sources are not acceptable, if any?
4. Daily budget for AI searches?

## Where things are in the repo

- Screen: `features/news/NewsView.tsx`
- Service the app calls: `services/news/newsApi.ts`
- Types: `services/api/pending.ts` (`NewsOut`, `NewsItem`, `NewsRegion`)
- Mock to delete when done: `services/mocks/news.ts` and its route in `services/mocks/routes.ts`
- Notes: `docs/open-items.md` (News section), `docs/integration.md`
