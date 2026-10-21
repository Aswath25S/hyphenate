# Before the Next Hire

An independent prototype that reads US finance and CFO-office job postings, splits each into single duties, and measures how many of those duties Hyphenate's AI agents already advertise. One extraction engine feeds three outputs:

- **Leads.** Which companies need Hyphenate now, and which product to lead with.
- **Gaps.** What postings ask for that Hyphenate's public site does not mention.
- **Minimum savings.** How much yearly salary is tied to duties Hyphenate already covers, as a deliberate floor.

Every score, gap and dollar figure links back to the posting text that produced it. Not affiliated with or endorsed by Hyphenate.

## Run it

Requires Node 20+ (the repo's `venv` links Node via nodeenv) and an OpenAI API key for the LLM stages.

```bash
source venv/bin/activate
npm install
cp .env.example .env          # set OPENAI_API_KEY
npm run pipeline              # collect → filter → extract → match → score → news → gaps → brief → publish
npm run findings              # writes FINDINGS.md from the published data
npm run dev                   # http://localhost:3000
```

Without an API key you can still run `collect`, `filter` and `score`, and preview the dashboard from the 10 hand-labelled fixtures:

```bash
npm run preview:fixtures && npm run dev
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run stage -- <name>` | Run one stage. Add `--as-of YYYY-MM-DD` to pin the 60-day window and trigger ages. |
| `npm run golden` | Rerun extraction and matching on the fixtures; writes `tests/fixtures/golden_report.json` (M1/M2 targets). |
| `npm run spotcheck` | Sample 20 random labels into `docs/spot-check.md` for human grading. |
| `npm run report:collection` | Rewrite `docs/collection-report.md`. |
| `npm run seed:discover -- <file>` | Probe candidate board slugs on Greenhouse, Lever and Ashby. |
| `npm test` · `npm run typecheck` · `npm run build` | Tests, types, production build. |

Environment: `OPENAI_API_KEY` (required for LLM stages), `OPENAI_MODEL` (default `gpt-5.5`), `LIVE_DEMO_ENABLED` (default `true`), `LIVE_DEMO_DAILY_LIMIT` (default `200`).

## How it is built

- `pipeline/stages/*.ts`: one file per stage, each reading the previous stage's JSON in `data/`.
- `pipeline/prompts/*.ts`: prompt text and schemas. Every LLM call (OpenAI, strict JSON-schema output) is cached by input hash, validated with zod, retried once, and logged with token cost.
- `lib/scoring.ts`: every formula, pure code, shared by the pipeline, the live demo and the dashboard sliders.
- `config/scoring.ts`: every weight, discount and threshold.
- `config/coverage_map.json`: 30 capabilities read from hyphenate.ai on 20 Oct 2026. Based on the public site, to be validated.
- `app/`, `components/`: Next.js dashboard. Only `/api/analyze` (the live demo) calls the LLM at request time.

See `SPEC.md` for the full specification and `DECISIONS.md` for every judgment call.

## Status

| Milestone | State |
| --- | --- |
| M0 Setup | Done |
| M1 Extraction on fixtures | 10 fixtures hand-labelled (draft, needs your review). Golden run needs an API key. |
| M2 Matching on fixtures | Same. |
| M3 Collection | Done: 152 postings from 94 companies (`docs/collection-report.md`). |
| M4 Full pipeline | All stages built and tested end to end with a fake LLM. Real run needs an API key. |
| M5 Dashboard | Done: 8 routes, evidence links, client-side recompute, 375 px checked. |
| M6 Live demo | Built and tested with a fake LLM. Timing target needs a real key to verify. |
| M7 Polish | `/method`, CSV exports, `FINDINGS.md` generator. Findings show preview numbers until the real run. |

## Known limits

- A posting shows pain and intent to hire, not budget or the real day-to-day work.
- Duties are not weighted by time spent; the 50% discount stands in for that.
- The coverage map is a reading of Hyphenate's public site and needs checking with Hyphenate.
- Public job boards over-represent tech and venture-backed companies.
- Salary data exists only where postings list it, mostly in states that require ranges.
- Model labels can be wrong; confidence scores and the evidence view let people check.
- Employee bands in `config/sources.csv` are unverified estimates.
- Live-demo rate limits are in memory, so they reset on restart and are per instance on serverless hosts.
- Pages are prerendered at build time; rebuild after `npm run pipeline` to publish new data.
