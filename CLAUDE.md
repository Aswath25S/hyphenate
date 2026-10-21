# Before the Next Hire

Prospect-intelligence prototype: finance job postings → single duties → coverage against Hyphenate's public capabilities → leads, gaps, minimum savings. Full spec in `SPEC.md`; choices in `DECISIONS.md`.

## Run

```bash
source venv/bin/activate          # Node is linked into the venv via nodeenv
npm install
cp .env.example .env              # set OPENAI_API_KEY
npm run pipeline                  # all 9 stages
npm run stage -- <name>           # one stage: collect filter extract match score news gaps brief publish
npm run stage -- filter --as-of 2026-10-20
npm run golden                    # rerun the 10 hand-labelled fixtures, report agreement
npm run preview:fixtures          # build data/app from fixture hand labels (no API key needed)
npm run dev                       # dashboard on :3000
npm test                          # vitest
npm run typecheck
```

## Conventions

- Pipeline writes JSON; the UI only reads `data/app/*.json`. Only `/api/analyze` calls the LLM (OpenAI) at request time.
- Every tunable number lives in `config/scoring.ts`. Never hard-code weights in components or stages.
- Scoring formulas live in `lib/scoring.ts` (pure, shared by pipeline, live demo and client-side sliders).
- Every LLM call goes through `pipeline/lib/llm.ts` → `callLlm` (OpenAI chat completions, strict JSON-schema output): cached by input hash in `data/cache/`, zod-validated, retried once, usage logged to `data/logs/usage.jsonl`.
- Prompts and their schemas live in `pipeline/prompts/*.ts`; zod schemas in `lib/schemas.ts`.
- Bump `CACHE_VERSION` in `pipeline/lib/llm.ts` or the prompt text to force re-calls.
- Keep data at company level. Never store recruiter or hiring-manager names. Never fetch LinkedIn, Indeed or Glassdoor (`assertAllowedHost`).
- Copy tone: short declarative sentences, sentence case. Savings are "work Hyphenate could absorb before the next hire", never people to cut. Gaps are "not on Hyphenate's public site", never "Hyphenate cannot".
- Ask the user before: paid data sources, changing scoring formulas, scraping unlisted sites, public deploys.
