# Decisions

Choices made inside the spec's latitude. Newest at the bottom of each section.

## Environment

- **Node inside the venv.** The user asked to use the existing `venv`. The stack is TypeScript, so `nodeenv` was installed into the venv and run with `-n system`. Activating the venv now puts the system Node (v24) on the path; `npm` installs stay project-local.
- **TypeScript 5.9, not 7.** TypeScript 7 (native compiler) is the npm `latest`, but Next.js 16 does not yet document support for it.
- **Next.js 16 + React 19 + Tailwind 4.** Tailwind 4's CSS-first config maps the design tokens directly (`@theme inline` in `app/globals.css`).

## Claude calls

- **Model default `claude-sonnet-5-5`**, overridable with `ANTHROPIC_MODEL` (spec).
- **No `temperature: 0`.** Sonnet 5.5 rejects non-default sampling parameters with a 400. Stability comes from the input-hash cache instead: the same input always returns the cached output.
- **No forced `tool_choice`.** Current models reject `{type: "tool"}`. We send `tool_choice: auto` with `disable_parallel_tool_use`, mark the tool `strict: true` (schema-valid arguments), and instruct "call X exactly once". A response without the tool call counts as a failure and gets the one retry.
- **Strict tool schemas are generated from zod** (`toToolSchema`). Bounds (min/max, lengths) are stripped from the tool schema because strict mode does not accept them; zod still enforces them after the call.
- **Server-side refusal fallback** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) is on by default. Set `ANTHROPIC_FALLBACKS=off` to disable.
- **Effort**: `medium` for extraction, matching, clustering and briefs; `low` for title checks, news and normalisation.
- **Retry with feedback.** The one retry appends the validation error to the user message so the model can correct it.
- **Deterministic post-rules on labels** (`finaliseLabels`): confidence below 0.6 becomes `unclear`; a `covered` label on a capability whose default is `assisted` becomes `assisted` (strictest fitting label). The model's original label is kept as `model_label` and shown in the evidence panel.

## Data collection

- **Seed discovery.** `pipeline/discover.ts` probed ~600 candidate slugs against the three public board APIs (Greenhouse, Lever, Ashby) and kept boards with recent US finance titles. `pipeline/discover-detail.ts` lists the surviving titles. Neither is a pipeline stage.
- **Excluded from seeds as likely over 5,000 employees:** OpenAI, Anthropic, Databricks, Lucid Motors.
- **Employee bands are unverified estimates.** Fetching a public size source (Wikipedia, company filings) would mean fetching a site not listed in the spec, which needs the user's go-ahead. Every row says `unverified estimate` in `size_note`, and `size_source_url` is blank. The UI shows "size unverified" next to every band. **Action for the user:** replace bands with sourced values.
- **Collect stores only plausible titles.** Boards return ~9,000 jobs; `collect` keeps postings whose title is not rejected by the role rules (`pipeline/lib/roles.ts`) to keep `data/raw` small. Every board's total job count is kept in the collection report.
- **Unclear titles** (e.g. "Head of Finance") go to a batched Claude check. Without an API key they are dropped and the count is logged.
- **Dates.** All three APIs expose a first-published date (Greenhouse `first_published`, Lever `createdAt`, Ashby `publishedAt`). Postings older than 60 days at the `--as-of` date are dropped.
- **Dedupe** uses Jaccard similarity on 5-word shingles ≥ 0.9 with the same domain and normalised title. Salary lines from merged location postings are appended to the extraction input as "pay listed on other location postings", so the lowest minimum is used.
- **Structured pay from job boards** (Lever `salaryRange`, Ashby compensation) is used only when the posting text has no salary. `salary_source` records which one was used.
- **Vendor exclusions** extended with Gusto, Melio, Justworks, Navan, Rippling and Deel (finance/payroll software).

## Scoring

- **Pain includes every open finance role,** including payroll and tax, as the spec says ("across the company's open finance roles"). This lowers pain for companies hiring payroll staff. Changing it would change the formula, so it is left for the user to decide.
- **Size band** is "in band" only when the whole band sits inside 200–5,000.
- **ERP "other"** (a named ERP outside both lists, e.g. Workday is in the enterprise list but "Coupa" is not an ERP) scores 0.5, same as not stated.
- **Gap salary attached** uses postings with a salary that are not thin, consistent with the savings honesty rules.
- **"Other" gap theme** sits in the `unclear` bucket.

## UI

- **Fonts.** hyphenate.ai uses Saans, Saans Mono (Displaay) and Bw Gradual, all commercial. We use Geist and Geist Mono (the `geist` package, self-hosted, OFL).
- **Colours** were confirmed against the site's production CSS (variables `--y3kxgx*`), which differ slightly from the spec's eyeballed values: page `#F9F7F1`, headlines `#550004`, brand `#84000D`, accent `#FF6716`, accent-soft `#FFE9DE`, muted ink `#897D71`. `styles/tokens.css` notes each source.
- **Author name** in the footer is `config/site.ts → AUTHOR_NAME`.

## M4 status

- **All nine stages are implemented and proven end to end with a fake Claude transport** (`tests/integration.test.ts`): breakdowns add up, every uncovered duty lands in exactly one theme, briefs pass the fact check, reruns hit the cache, usage is logged per stage.
- **The real M4 run needs `ANTHROPIC_API_KEY`**, which was not available in the build session. Run `npm run pipeline` (or stage by stage) once it is set. Expected spend at list prices is a few dollars: ~150 extraction calls and ~150 matching calls on Sonnet 5.5, plus ~2 gap calls, ~30 news calls and 15 briefs.
- **News headlines can name executives** (e.g. "Acme names Jane Doe CFO"). They are stored as published news context for the trigger, at company level. No recruiter or hiring-manager data is collected from postings.
