# Decisions

Choices made inside the spec's latitude. Newest at the bottom of each section.

## Environment

- **Node inside the venv.** The user asked to use the existing `venv`. The stack is TypeScript, so `nodeenv` was installed into the venv and run with `-n system`. Activating the venv now puts the system Node (v24) on the path; `npm` installs stay project-local.
- **TypeScript 5.9, not 7.** TypeScript 7 (native compiler) is the npm `latest`, but Next.js 16 does not yet document support for it.
- **Next.js 16 + React 19 + Tailwind 4.** Tailwind 4's CSS-first config maps the design tokens directly (`@theme inline` in `app/globals.css`).

## LLM calls

- **OpenAI instead of Anthropic (user decision, 21 Oct 2026).** The spec named the Anthropic SDK; the user asked to switch to the OpenAI API because they already have credits. All calls go through `pipeline/lib/llm.ts` using the official `openai` package (chat completions). The swappable transport means tests and stages did not change shape.
- **Model default `gpt-5.5`**, overridable with `OPENAI_MODEL`. Chosen as the newest general GPT-5 model listed in the installed SDK; a `-mini` model is the cheaper option if quality holds on the golden fixtures.
- **Structured output** uses `response_format: json_schema` with `strict: true`, generated from the zod schemas (`toResponseSchema`). Bounds (min/max, lengths) are stripped from the JSON schema and still enforced by zod after the call.
- **No `temperature: 0`.** GPT-5 reasoning models do not accept a custom temperature. Stability comes from the input-hash cache: the same input always returns the cached output.
- **Effort** maps to `reasoning_effort` (`medium` for extraction, matching, clustering and briefs; `low` for title checks, news, normalisation and the live demo). It is only sent to reasoning models (`gpt-5*`, `o*`, not `*-chat*`).
- **Token budgets** (`max_completion_tokens`) were roughly doubled versus the Anthropic version because reasoning tokens count toward the limit.
- **Refusals and truncation** (`message.refusal`, `finish_reason: "length"`) count as failures and get the one retry.
- **Retry with feedback.** The one retry appends the validation error to the user message so the model can correct it.
- **Prices are not hard-coded.** `config/scoring.ts → LLM.pricePerMTok` is empty; fill in rates from your OpenAI pricing page. Until then the cost report shows token counts and "price not set".
- **Deterministic post-rules on labels** (`finaliseLabels`): confidence below 0.6 becomes `unclear`; a `covered` label on a capability whose default is `assisted` becomes `assisted` (strictest fitting label). The model's original label is kept as `model_label` and shown in the evidence panel.
- **Cache version bumped** (`v2-openai`), so no Anthropic-era cache entries are reused.

## Data collection

- **Seed discovery.** `pipeline/discover.ts` probed ~600 candidate slugs against the three public board APIs (Greenhouse, Lever, Ashby) and kept boards with recent US finance titles. `pipeline/discover-detail.ts` lists the surviving titles. Neither is a pipeline stage.
- **Excluded from seeds as likely over 5,000 employees:** OpenAI, Anthropic, Databricks, Lucid Motors.
- **Employee bands are unverified estimates.** Fetching a public size source (Wikipedia, company filings) would mean fetching a site not listed in the spec, which needs the user's go-ahead. Every row says `unverified estimate` in `size_note`, and `size_source_url` is blank. The UI shows "size unverified" next to every band. **Action for the user:** replace bands with sourced values.
- **Collect stores only plausible titles.** Boards return ~9,000 jobs; `collect` keeps postings whose title is not rejected by the role rules (`pipeline/lib/roles.ts`) to keep `data/raw` small. Every board's total job count is kept in the collection report.
- **Unclear titles** (e.g. "Head of Finance") go to a batched LLM check. Without an API key they are dropped and the count is logged.
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

- **All nine stages are implemented and proven end to end with a fake LLM transport** (`tests/integration.test.ts`): breakdowns add up, every uncovered duty lands in exactly one theme, briefs pass the fact check, reruns hit the cache, usage is logged per stage.
- **The real M4 run needs `OPENAI_API_KEY`**, which was not available in the build session. Run `npm run pipeline` (or stage by stage) once it is set. Volume: ~150 extraction calls and ~150 matching calls, plus ~2 gap calls, ~30 news calls and 15 briefs.
- **News headlines can name executives** (e.g. "Acme names Jane Doe CFO"). They are stored as published news context for the trigger, at company level. No recruiter or hiring-manager data is collected from postings.

## M7

- **FINDINGS.md is generated** (`npm run findings`) from `data/app`, so the memo always matches the dashboard. It is marked as a preview while the data comes from fixtures.
- **Spot check.** `npm run spotcheck` writes 20 random labels to `docs/spot-check.md`. The spec asks for the results here after each full run; none yet, because the full run has not happened.
- **Live-demo limits are in memory.** Good enough for a demo on one server; a public deploy should use a shared store.
- **Pages are statically prerendered.** The data only changes when the pipeline runs, so rebuild (`npm run build`) after publishing.

## Deduplication (22 Oct 2026)

- **Trigger events.** One story covered by several outlets was stored as several triggers (86 articles for 34 events). Items of the same trigger type within 14 days (`TRIGGER_DEDUPE_DAYS`) are now one event. The representative is the item that already scores highest for timing, so lead scores are unchanged; the other outlets are kept as `also_reported` and shown as "Also reported by" links.
- **Roles.** The spec's 90% similarity threshold missed copies of one role posted for different locations (Reddit UK/US, Oscar Health). Same company + same normalised title now merges at 75%. Different titles merge only when the descriptions are near-verbatim (≥ 95%) and the titles do not differ only by a site suffix, so "Plant Controller, Cape / Stennis / Long Beach" stay three openings. This merged 5 postings (Fivetran, Oscar Health, Reddit ×2, Samsara).
- **Left separate on purpose:** level variants with different titles and 83–90% similar text (Samsara "Revenue Accounting Manager" vs "Senior Manager, Revenue Accounting"; Headway "Strategic Finance Manager" vs "Senior Strategic Finance Manager"; Mixpanel G&A vs GTM). They may be one hiring need at two levels; review if you want them merged.
- **Re-run scope.** Filter was re-run with `--as-of 2026-10-21` on the already-collected postings, then extract → publish. News was not re-fetched. Astranis's Financial Analyst posting sits on the 60-day edge and is now included.

## Triggers removed (22 Oct 2026, user decision)

- **The news/trigger feature was removed from the demo** as too heavy for its purpose: the news stage, Google News RSS fetching, trigger classification and dedupe, the "Why now" section, the trigger filter and column, and the brief's "why now" field. The pipeline is now eight stages.
- **Lead score is now pain and fit only.** The 25% timing weight was dropped and the other two keep their 2:1 ratio: pain 2/3 (≈67%), fit 1/3 (≈33%), in `config/scoring.ts → LEAD_WEIGHTS`. This changes the scoring formula from the spec at the user's request. Rankings shifted (Latitude still first); briefs were regenerated for the new top 15.
- The earlier "Deduplication" note's trigger part no longer applies; the role dedupe still does.
