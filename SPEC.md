# Before the Next Hire — Build Spec

Oct 20, 2026 · @Aswath

## Overview

Build a prospect-intelligence tool that reads finance and CFO-office job postings, splits each one into individual duties, and measures how many of those duties Hyphenate's AI agents already perform. One extraction engine feeds three outputs: a ranked lead list, a gap report, and a minimum cost-savings estimate.

**Thesis.** A company posting a finance role whose duties Hyphenate automates is announcing that it is about to spend money on the exact problem Hyphenate solves. Company news (funding, acquisitions, new CFO, new countries, ERP changes) explains why now.

**Who it is for.** A job application demo for the Startup Generalist (New Grad) role at [Hyphenate](https://hyphenate.ai/). The audience is the founders. It must look credible, run live, and be honest about its assumptions.

**The three outputs**

| Output | Question it answers | Main view |
| --- | --- | --- |
| Overlap and lead ranking | Which companies need Hyphenate right now, and which product do we lead with? | Leads table + company brief |
| Gap analysis | What do finance job postings ask for that Hyphenate does not advertise? | Ranked gap themes with example phrases |
| Minimum cost savings | How much yearly salary is tied to duties Hyphenate already covers? | Per-role, per-company and dataset totals |

**Demo success criteria**

- About 200 real postings from about 50 US companies (200 to 5,000 employees), posted in the last 60 days, processed end to end.
- Every score, gap and dollar figure can be traced back to the posting text that produced it.
- A visitor can paste any finance job posting and see it extracted, scored and priced live in under 30 seconds.
- The UI reads as a sibling of hyphenate.ai in colour, type and tone, without using Hyphenate's logo or claiming to be an official Hyphenate product.
- A one-page findings memo can be written straight from the dashboard's numbers.

**Naming and framing.** Working name: *Before the Next Hire*. Frame savings as work Hyphenate could absorb before a company makes its next hire, never as people to cut.

## Instructions for Claude Code

Work through the milestones in the last section in order, and stop for review at the end of each one. Commit after each milestone with a message naming it.

1. Read this whole spec before writing code. Save it in the repo as `SPEC.md` and keep a short `CLAUDE.md` with run commands and conventions.
2. Build the data pipeline before the UI. The UI only reads files the pipeline writes.
3. Make every number traceable. Each score, gap and dollar figure keeps the ids of the postings and duties behind it, and the UI can always show that evidence.
4. Put every tunable number (weights, discounts, thresholds) in one config file. Never hard-code them in components.
5. Cache every Claude call by a hash of its input, so reruns cost nothing and results stay stable.
6. Validate every Claude response against a schema. Retry once on failure, then log the posting as failed and move on.

**Ask the user before you:** add a paid data source, change the scoring formulas, scrape any site not listed in Data collection, or deploy anywhere public.

**Decide yourself and note it in `DECISIONS.md`:** library choices, file layout details, prompt wording, UI details inside the design system.

**Never:** scrape LinkedIn, Indeed or Glassdoor; store personal data about individual people; use Hyphenate's logo, customer logos or copied images; present the tool as an official Hyphenate product.

## Tech stack and architecture

One TypeScript repo: a batch pipeline of Node scripts writes JSON files, and a Next.js app reads them. Only the live paste-a-posting feature calls Claude at request time.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | One language for pipeline and UI |
| Pipeline runner | Node scripts run with `tsx`, one per stage | Each stage can be rerun alone |
| LLM | Anthropic SDK (`@anthropic-ai/sdk`), model from env, default `claude-sonnet-5-5` | Tool use with JSON schemas gives structured output |
| Validation | `zod` | Rejects malformed model output |
| Storage | JSON files in `data/` | Small dataset, easy to inspect and commit |
| Web app | Next.js (App Router) + Tailwind CSS | Fast to build, easy to deploy |
| Charts | Recharts | Simple bar and distribution charts |
| Tests | Vitest | Formula and schema tests |

**Pipeline stages** (each reads the previous stage's output)

1. `collect`: fetch postings from sources into `data/raw/postings/*.json`.
2. `filter`: keep finance and CFO-office roles posted in the last 60 days; dedupe.
3. `extract`: Claude turns each posting into structured fields and single duties.
4. `match`: Claude labels each duty against the coverage map.
5. `score`: compute overlap, fit, timing, lead score and savings (pure code, no LLM).
6. `news`: fetch and classify trigger events for companies above a score cut-off.
7. `gaps`: normalise and cluster uncovered duties into themes.
8. `brief`: Claude writes a short brief per top company from structured data only.
9. `publish`: write the final `data/app/*.json` files the UI reads.

`npm run pipeline` runs all stages; `npm run stage -- <name>` runs one.

&#91;embedded content: pipeline · 9 stages plus the live demo\]

Highlighted stages call Claude; Score and Publish are plain code, so the same labels always give the same numbers. The live demo runs Extract, Match and Score on one pasted posting without touching stored data.

**Repo layout**

```
/SPEC.md  /CLAUDE.md  /DECISIONS.md
/config/scoring.ts        weights, discounts, thresholds
/config/coverage_map.json Hyphenate capabilities
/config/sources.csv       seed companies and their job-board ids
/config/exclusions.json   existing customers, vendors
/pipeline/stages/*.ts     one file per stage
/pipeline/prompts/*.ts    prompt text + JSON schemas
/pipeline/lib/            claude client, cache, fetchers
/data/raw/  /data/processed/  /data/app/  /data/cache/
/app/                     Next.js routes
/components/              UI components
/styles/tokens.css        design tokens
/tests/fixtures/          hand-labelled postings
```

**Environment variables:** `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL` (optional), `LIVE_DEMO_ENABLED` (default `true`), `LIVE_DEMO_DAILY_LIMIT` (default `200` requests).

## Data collection

Collect about 200 finance postings from about 50 US companies with 200 to 5,000 employees, using public job-board APIs that companies publish for exactly this purpose. News comes from public RSS feeds.

**Job sources** (verify each endpoint against its public docs before use)

| Source | Endpoint pattern | Notes |
| --- | --- | --- |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | Full description HTML in `content` |
| Lever | `https://api.lever.co/v0/postings/{site}?mode=json` | Description split into lists |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | Often includes salary |
| Manual import | `data/raw/manual/*.txt` or a URL list | For postings found any other way |

**Seed list.** `config/sources.csv` holds one row per company: `company, domain, ats, board_token, employee_band, hq_state, size_source_url`. Build it by searching for public job boards that list finance roles (for example, Greenhouse boards with "staff accountant" and "NetSuite" in a posting). Fill `employee_band` from a public source and keep its URL. Target 60 to 80 seed companies so roughly 50 have open finance roles.

**Roles to keep** (title match first, Claude check for unclear titles)

- Accounts receivable, billing, collections, cash application, credit
- Accounts payable, procurement accounting, vendor management
- Staff, senior, GL, general, revenue, technical and corporate accountant
- Close manager, accounting manager, assistant controller, controller
- Treasury analyst or manager
- Financial reporting, FP&A analyst
- Payroll and tax accountant (kept mainly for the gap analysis)

Drop internships, CFO and VP titles with no listed duties, and postings older than 60 days.

**Dedupe.** Treat two postings as one role when the company and normalised title match and the descriptions are at least 90% similar. Keep every location's salary range on the one record.

**News sources**

- Google News RSS search per company, for example `https://news.google.com/rss/search?q="{company}"+(acquires OR raises OR CFO OR expansion)`
- The company's own newsroom or blog RSS feed, when one exists
- Optional: SEC EDGAR filings for public companies (ask before adding)

**Fetching rules**

- One request per second per host, an honest user agent, and respect for `robots.txt` on any HTML page.
- Store `source_url` and `fetched_at` with every record.
- Keep data at the company level. Do not store names, emails or profiles of recruiters or hiring managers.
- Never scrape LinkedIn, Indeed or Glassdoor.

## Extraction

One Claude call per posting turns the description into structured fields and a list of single duties. Duty splitting is the step everything else depends on, so it gets its own tests.

**Schema** (`pipeline/prompts/extract.ts`, mirrored in `zod`)

```ts
type Posting = {
  posting_id: string;            // hash of company + title + source_url
  company: string; domain: string;
  title: string;
  role_family: 'AR' | 'AP' | 'GL' | 'Revenue' | 'Treasury' | 'Reporting_FPA'
             | 'Close_Mgmt' | 'Controller' | 'Payroll' | 'Tax' | 'Other';
  seniority: 'entry' | 'mid' | 'senior' | 'manager' | 'director_plus';
  locations: string[]; remote: 'onsite' | 'hybrid' | 'remote' | 'unknown';
  salary: {
    min: number | null; max: number | null;
    period: 'year' | 'hour' | null; currency: 'USD' | null;
    raw_text: string | null;     // exact salary sentence from the posting
  };
  erp: string[];                 // e.g. ['NetSuite']
  tools: string[];               // e.g. ['Excel','BlackLine','Bill.com']
  complexity: {
    multi_entity: boolean; multi_currency: boolean;
    usage_based_billing: boolean; high_volume: boolean;
    entity_count: number | null;
  };
  pain_phrases: string[];        // verbatim, max 8, e.g. 'manual reconciliations'
  duties: Duty[];
  posted_at: string | null; source_url: string; fetched_at: string;
};

type Duty = {
  duty_id: string;               // posting_id + index
  text: string;                  // one task, rewritten as a short imperative
  source_span: string;           // verbatim text it came from
  is_boilerplate: boolean;       // 'other duties as assigned', culture lines
  is_requirement: boolean;       // a qualification, not a task (e.g. 'CPA preferred')
};
```

**Duty-splitting rules** (put these in the prompt)

1. One action per duty. "Reconcile bank accounts and partner with sales on disputes" becomes two duties.
2. Keep the object and frequency: "Apply customer payments daily", not "Payments".
3. Only the responsibilities section produces duties. Qualifications become `is_requirement: true` and are excluded from scoring.
4. Mark culture lines, "other duties as assigned" and "special projects" as boilerplate.
5. Copy `source_span` verbatim so the UI can highlight it in the original text.
6. Never invent salary, ERP or tools. Unknown means `null` or an empty list.

**Salary normalisation (code, not LLM).** Hourly pay × 2,080 = yearly. With several location ranges, keep the lowest `min` and record that a range varies by location. A single figure counts as `min`. Non-USD postings are dropped.

**Prompt shape.** System prompt with the rules and two worked examples (one AR, one senior accountant). The posting text goes in a `<posting>` block. Output goes through a tool whose input schema is the JSON schema above, with `temperature: 0`.

## Coverage map

The coverage map lists 30 capabilities across Hyphenate's five products, taken from its public [platform](https://hyphenate.ai/platform) and [controller](https://hyphenate.ai/controller) pages on 20 Oct 2026. It is our reading of public claims, not Hyphenate's own list, so the UI labels it "based on public site, to be validated".

**Default level.** `covered` means the site says the agent does the work end to end. `assisted` means the site says the agent prepares it and a person approves, or the task needs judgment.

| id | Product | Capability | Default |
| --- | --- | --- | --- |
| o2c.contract\_terms | Order-to-cash | Extract contract terms, obligations and pricing | covered |
| o2c.rev\_rec | Order-to-cash | Apply ASC 606 policy, build revenue schedules and documentation | assisted |
| o2c.invoicing | Order-to-cash | Create and send invoices, including usage-based billing | covered |
| o2c.collections | Order-to-cash | Send payment reminders and chase overdue invoices | covered |
| o2c.orders\_refunds | Order-to-cash | Process orders, refunds and sales triage | covered |
| tre.cash\_application | Treasury | Match bank activity to open invoices and bills | covered |
| tre.exceptions | Treasury | Flag short-paid, unmatched or over-policy items | assisted |
| tre.bank\_rec | Treasury | Daily bank reconciliation | covered |
| tre.cash\_position | Treasury | Cash position across accounts, entities and banks | covered |
| tre.forecast | Treasury | 13-week cash forecast | assisted |
| gl.close\_checklist | GL accounting | Run month-end close checklist tasks | covered |
| gl.journal\_entries | GL accounting | Prepare and post journal entries | assisted |
| gl.account\_recs | GL accounting | Balance-sheet account reconciliations | covered |
| gl.subledgers | GL accounting | Prepaids, fixed assets, ASC 842 leases, R&D capitalisation | covered |
| gl.accruals | GL accounting | Estimate accruals from history, POs and budget | assisted |
| gl.intercompany | GL accounting | Intercompany recs, eliminations and allocations | covered |
| gl.flux | GL accounting | Variance (flux) analysis with draft commentary | assisted |
| gl.controls | GL accounting | Monitor manual entries and close controls | covered |
| gl.audit\_support | GL accounting | Audit trail and support for each entry | assisted |
| p2p.bill\_capture | Procure-to-pay | Read and code vendor bills to GL, class and entity | covered |
| p2p.allocations | Procure-to-pay | Split bills across departments or classes | covered |
| p2p.po\_matching | Procure-to-pay | Match bills to purchase orders | covered |
| p2p.approvals | Procure-to-pay | Route approvals by policy | covered |
| p2p.vendor\_followup | Procure-to-pay | Chase vendors for missing invoices or details | covered |
| p2p.aging | Procure-to-pay | Track open payables until resolved | covered |
| p2p.payments | Procure-to-pay | Prepare payment runs for approval | assisted |
| rep.consolidation | Reporting | Roll entities and ERPs into one view, map charts of accounts | covered |
| rep.management\_reports | Reporting | Build management reports and board decks | assisted |
| rep.adhoc\_analysis | Reporting | Answer finance questions traced to source entries | assisted |
| rep.driver\_analysis | Reporting | Explain changes using CRM, contract or bill data | assisted |

**File format** (`config/coverage_map.json`): each entry has `id`, `product`, `capability`, `default_level`, `example_phrases` (3 to 6 typical job-posting phrasings), `not_included` (near misses that should not match, e.g. payroll under `p2p.payments`) and `source_url`.

**Known not-advertised areas.** Seed the gap analysis with these, without claiming Hyphenate cannot do them: payroll processing, sales and use tax filing, 1099s, sales commissions, expense-report review, budgeting and planning models, inventory and cost accounting, equity and stock-comp accounting.

**Existing customers to exclude from leads** (`config/exclusions.json`, from the public site): Kiteworks, HiBid, Dura Software, Mini Melts, Quantum, Eightfold, Sierra, Rently. Also exclude finance-software vendors as lead companies.

## Matching and overlap scoring

Claude labels each scored duty against the coverage map. Code, not Claude, then computes the overlap numbers, so the same labels always give the same score.

**Labels per duty** (one Claude call per posting, all its duties at once, coverage map in the prompt)

| Label | Meaning | Shown as |
| --- | --- | --- |
| `covered` | The duty's core action is a `covered` capability | Green |
| `assisted` | The duty matches an `assisted` capability, or a covered one but needs judgment | Orange tint |
| `human` | People work by nature: managing staff, presenting, partnering with other teams, working with auditors | Grey |
| `gap_candidate` | Repetitive work that could be automated but matches no capability | Grey, dotted underline |
| `unclear` | Too vague to judge, or confidence below 0.6 | Grey, italic |

Each label carries `capability_id` (required for covered and assisted), `confidence` (0 to 1) and a one-sentence `rationale`. A label of covered or assisted without a valid `capability_id` is rejected and retried.

**Matching rules for the prompt**

- Match on the action, not the topic. "Review and approve journal entries prepared by staff" is human review, not `gl.journal_entries`.
- Use the strictest fitting label. When torn between covered and assisted, choose assisted.
- Check `not_included` near misses before matching.
- Boilerplate and requirement lines are never sent to matching.

**Posting formulas** (n = number of scored duties; C, A = covered and assisted counts)

```latex
\text{covered share} = \frac{C}{n} \qquad \text{overlap} = \frac{C + A}{n} \qquad \text{weighted overlap} = \frac{C + 0.5A}{n}
```

- Overlap is the headline figure the UI shows ("88% overlap").
- Weighted overlap feeds the lead score, so assisted work counts half.
- Postings with fewer than 4 scored duties get scores but are flagged "thin posting" and excluded from savings.

**Product split per posting.** Count covered and assisted duties per product. The product with the most weighted duties is the posting's *lead product*; ties go to the product with more covered duties.

## Lead prioritization

Each company gets a lead score from 0 to 100: half from pain (overlap), a quarter from fit, a quarter from timing. All weights live in `config/scoring.ts` and can be changed with sliders in the UI.

```latex
\text{Lead score} = 100 \times (0.50 \cdot \text{Pain} + 0.25 \cdot \text{Fit} + 0.25 \cdot \text{Timing})
```

**Pain (0 to 1).** 0.8 × the average weighted overlap across the company's open finance roles, plus 0.2 × min(open roles, 4) ÷ 4. Three open AR roles beat one.

**Fit (0 to 1).** 0.4 × ERP + 0.3 × size + 0.3 × complexity.

| Factor | 1.0 | 0.5 | 0.2 to 0.3 |
| --- | --- | --- | --- |
| ERP | NetSuite, SAP, Sage Intacct, Microsoft Dynamics, Oracle | Not stated | QuickBooks or Xero only (0.2) |
| Size | 200 to 5,000 employees | Unknown | Outside the band (0.3) |
| Complexity | 2 or more of: multi-entity, multi-currency, usage-based billing, high volume | 1 of them | None (0.2) |

**Timing (0 to 1).** The strongest trigger event, weighted by type and age. No trigger means 0.

| Trigger | Weight | Why it matters |
| --- | --- | --- |
| Acquisition | 1.0 | New entities and books to combine |
| New CFO or controller | 0.9 | New leaders review tools early |
| ERP change or implementation | 0.9 | Processes are being rebuilt anyway |
| IPO or SOX readiness | 0.9 | Everything must become audit-ready |
| Funding round | 0.8 | Growth outpaces the finance team |
| International expansion | 0.7 | New currencies, banks and entities |
| Move to usage-based pricing | 0.7 | Billing and revenue get harder |
| Restructuring or layoffs | 0.4 | Pressure to do more with fewer people |

Age multiplier: 1.0 within 90 days, 0.5 from 91 to 180 days, 0 after that.

**News classification.** Run news only for the top 30 companies by Pain and Fit, to keep it cheap. Claude reads each headline and snippet and returns `trigger_type`, `event_date`, a one-line summary and `confidence`. Keep items with confidence of at least 0.7 where the company is named in the headline. Store the article URL for every trigger.

**Tool signals (shown, not scored).** List finance-automation tools named in postings, such as BlackLine, FloQast, Numeric, HighRadius, Bill.com or Tipalti. They tell sales what the team already uses.

**Exclusions.** Existing customers and finance-software vendors stay in the dataset for research totals but never appear in the leads list.

**Company brief.** For the top 15 companies, Claude writes a brief from structured data only, with these fields:

- **Headline:** one sentence, e.g. "Acme is hiring its third AR specialist to match payments by hand."
- **Why them:** overlap, open roles and ERP, each linked to its posting.
- **Why now:** the trigger, linked to its article.
- **Lead with:** the product with the most weighted duties across their roles.
- **Minimum savings:** from the savings model.
- **What Hyphenate may not cover:** their top gap themes.
- **Angle:** "before your next hire" in one sentence.

A check after generation confirms every number and name in the brief appears in the source data; a brief that fails is regenerated once, then dropped.

## Gap analysis

The gap view groups every duty Hyphenate does not advertise into themes and ranks them by how often they show up in otherwise strong leads. Its purpose is product input: what to build next, and what prospects will ask about.

**Steps**

1. **Collect** all duties labelled `gap_candidate`, `human` or `unclear`.
2. **Normalise.** Claude rewrites each as a short canonical task ("Prepare and file monthly sales tax returns" becomes "file sales and use tax returns"). Batch 100 duties per call.
3. **Cluster.** Send the full list of canonical tasks (with counts) to Claude in one call and get back 15 to 40 themes. Each theme has a name, one-line description, bucket and member duty ids. Seed the prompt with the known not-advertised areas from the coverage map.
4. **Check.** Every duty id lands in exactly one theme; themes with fewer than 3 duties merge into "Other".

**Buckets**

| Bucket | Meaning | Examples |
| --- | --- | --- |
| `human_work` | Needs people by nature; not a product gap | Managing staff, presenting to leadership, auditor relationships |
| `possible_gap` | Repetitive work that could be automated but is not on the public site | Sales tax filing, commissions, payroll, expense review |
| `unclear` | Too vague to judge | "Special projects", "support the team as needed" |

**Metrics per theme**

| Metric | Definition |
| --- | --- |
| Postings | Postings with at least one duty in the theme |
| Companies | Distinct companies with the theme |
| Share of strong leads | Share of postings with overlap of at least 60% that include the theme. This is the main ranking metric: a gap in an otherwise good lead is the gap that blocks a deal |
| Salary attached | Sum over postings of salary min × theme duties ÷ n, labelled "minimum, indicative" |
| Roles | Role families where it appears |
| Example phrases | Up to 5 verbatim `source_span`s, each linked to its posting |
| Verification | `unverified` by default; the user can set `confirmed gap` or `actually supported` in the UI (stored locally) |

**Rules.** Never state that Hyphenate cannot do something. The view says "not on Hyphenate's public site" and keeps the verification column visible. `human_work` themes appear in a separate, collapsed list so they do not crowd out real product gaps.

## Minimum cost savings

The savings figure is a deliberate floor: the lowest advertised salary, times the share of fully covered duties, cut in half. It is pure code in `pipeline/stages/score.ts`, with every input shown in the UI.

```latex
\text{Minimum savings per role} = \text{salary}_{\min} \times \frac{C}{n} \times d
```

Here C ÷ n is the covered share, and d is the safety discount (default 0.5, for exception review and unequal duty time).

**Worked example.** AR Specialist posted at $65,000 to $80,000, 5 of 8 duties covered: $65,000 × 5/8 × 0.5 ≈ **$20,300 a year, minimum**.

**Assumptions and controls** (all in `config/scoring.ts`, all adjustable in the Savings view)

| Setting | Default | Range | Why the default is conservative |
| --- | --- | --- | --- |
| Salary used | Bottom of range | Bottom, midpoint | Assumes the lowest advertised pay |
| Discount d | 0.5 | 0.25 to 1.0 | Review time and unequal duty length |
| Count assisted duties | Off | Off, or at 0.25 weight | Assisted work still needs a person |
| Loaded-cost multiplier | 1.0 | 1.0 to 1.4 | Ignores benefits and payroll taxes by default |

The UI shows the default figure as the headline and any user-adjusted figure beside it, labelled "your assumptions".

**Rollups**

- **Per company:** sum across its distinct open roles, shown as "at least $X a year across N roles".
- **By role family:** total and median, to show where the money sits (AR, AP, GL and so on).
- **Dataset headline:** "Across N postings with salaries, at least $X a year is tied to duties Hyphenate's agents already handle."

**Honesty rules**

1. No salary in the posting means no figure. Show "no salary posted"; never estimate one.
2. Thin postings (fewer than 4 scored duties) are excluded.
3. Always phrase it as "work Hyphenate could absorb before your next hire", never as people to cut.
4. Hyphenate's price is unknown, so this is gross value, not net savings. Say so under every total.
5. Show salary coverage next to every total: "based on 132 of 204 postings that list a salary".

## Dashboard

Eight routes, each opening with an eyebrow pill and a large headline that states a finding computed from the data (for example "38 companies are hiring for work Hyphenate already does."), never a generic page title.

| Route | Purpose | Main components |
| --- | --- | --- |
| `/` Overview | The story in one screen | Headline finding; 4 stat blocks (postings analysed, companies, median overlap, minimum $ total); top 5 leads; top 3 gaps; link to method |
| `/leads` | Ranked companies | Sortable table: rank, company, lead score, overlap, open roles, minimum savings, lead product, top trigger, ERP. Filters: role family, ERP, size, state, has salary, trigger type. Weight sliders in a side panel |
| `/companies/[slug]` | One company's case | Brief; open roles with overlap bars; product split; triggers with dates and article links; tools used; savings; gaps for this company |
| `/postings/[id]` | Evidence view | Original posting text with each duty's `source_span` highlighted in its label colour; side panel per duty: label, capability, confidence, rationale; extracted fields; salary; source link |
| `/gaps` | What Hyphenate does not advertise | Possible gaps ranked by share of strong leads; expand a row for example phrases, companies and roles; verification dropdown; human-work themes collapsed below |
| `/savings` | The money | Formula block with live inputs; with-vs-without comparison bars; per-company bar chart; by role family; dataset total with salary coverage |
| `/try` | Live demo | Paste box (max 20,000 characters), optional company and title; result rendered exactly like a posting page |
| `/method` | Trust | How it works, the coverage map table, every assumption, known limits, data sources and dates |

**Key interactions**

- Every number links to its evidence: a lead score opens its breakdown, a savings figure opens the roles behind it, a gap count opens its postings.
- Hovering a highlighted duty shows the matched capability and rationale.
- Slider and toggle changes recompute scores client-side and update tables instantly; a "reset to defaults" link is always visible.
- Sorting and filter state lives in the URL so a view can be shared.
- Export buttons on Leads and Gaps download CSV.

**Live demo (`/try`)**

- Calls `POST /api/analyze` with `{ text, company?, title? }`, which runs extraction and matching back to back and scores in code.
- Shows progress as status chips, in the style of the site's agent-status chips: "Reading posting", "Splitting duties", "Matching to products", "Pricing".
- Target under 30 seconds. On failure, show a plain error and keep the pasted text.
- Never store or log pasted text. Enforce `LIVE_DEMO_DAILY_LIMIT` and a per-IP limit of 10 an hour.
- Include two sample postings behind "Try an example" buttons.

**Footer on every page:** "Independent prototype by \[your name\], built to study Hyphenate's market. Not affiliated with or endorsed by Hyphenate. Coverage based on hyphenate.ai as of 20 Oct 2026."

## Design system

Match hyphenate.ai's look: warm cream pages, very large oxblood headlines in a tight sans, small uppercase mono labels, one vivid orange accent, and finance data shown in calm, bordered cards. Colour values below are sampled by eye from screenshots of the site. Before styling, fetch the site's CSS, confirm the real values and font names, and update `styles/tokens.css`.

**Colour tokens**

```css
:root {
  --bg:            #FAF6F0;  /* warm cream page */
  --bg-raised:     #FDFBF8;  /* lighter section bands */
  --surface:       #FFFDFB;  /* cards */
  --surface-tint:  #F8EEE8;  /* selected row */
  --ink-display:   #4A0A10;  /* headlines, oxblood */
  --brand:         #790005;  /* primary buttons (site theme colour) */
  --ink:           #2A211E;  /* body text */
  --ink-muted:     #8A7F78;  /* mono labels, axis text */
  --line:          #EAE3DB;  /* borders, hairlines */
  --line-dashed:   #E3DAD0;  /* dashed row separators */
  --accent:        #F2541B;  /* orange: active states, bars, rings */
  --accent-soft:   #FDE2D6;  /* pill and highlight fill */
  --success:       #2DB46A;  /* done, covered */
  --success-soft:  #E3F4EA;
}
```

**Typography**

| Role | Style |
| --- | --- |
| Hero headline | 64 to 76 px, regular weight, letter-spacing about -0.03em, line-height 1.02, `--ink-display` |
| Section headline | 40 to 48 px, same treatment |
| Sub-headline | 28 to 34 px, `--ink-display` |
| Body | 16 px, line-height 1.5, `--ink` |
| Card title | 17 px, medium weight |
| Mono label | 11 to 12 px, uppercase, letter-spacing 0.08em, `--ink-muted`, e.g. `AS OF OCT 20 · 204 POSTINGS` |
| Numbers | Tabular figures, right-aligned, negatives in parentheses |

The site uses a neo-grotesk display sans. Read the real font-family from the site's CSS. If it is a commercial font, do not copy its files: use the closest free option (Geist or Inter Tight for sans, Geist Mono for mono) and note it in `DECISIONS.md`.

**Layout**

- Floating top nav: centred white card, 1 px border, radius 10 px, soft shadow, 14 px links, maroon "Try it live" button on the right.
- Hero areas: cream background with a faint horizontal dashed-line texture, and a few short orange hairlines as accents.
- Sections separated by full-width 1 px hairlines; page content framed by thin vertical rules at the container edges (max width about 1,520 px).
- Big section containers: radius 24 px, 1 px `--line` border. Inner cards: radius 12 to 16 px, `--surface`, soft warm shadow (`0 20px 60px rgba(120, 60, 20, 0.08)`).
- Areas behind data cards use a very light diagonal hatch (`repeating-linear-gradient` at 45 degrees).
- Generous whitespace: 96 to 128 px between sections on desktop.

**Components**

| Component | Look |
| --- | --- |
| Eyebrow pill | `--accent-soft` fill, `--accent` text, 15 px, fully rounded, e.g. "The leads", "The gaps", "The money" |
| Primary button | `--brand` fill, white 15 px medium text, radius 4 px |
| Secondary button | Transparent, 1 px `--brand` border, `--brand` text |
| Side list (filters, routes) | Plain rows; the active row gets `--surface-tint` fill, a 3 px `--accent` left border and `--accent` text |
| Data table | No vertical lines; dashed `--line-dashed` row separators; mono uppercase sub-labels under row names; figures right-aligned |
| Stat block | Large number (48 to 64 px, `--ink-display`) with a mono label beneath, e.g. **88%** / `MEDIAN OVERLAP` |
| Comparison bars | Highlighted bar: `--accent-soft` fill, 1 px `--accent` border, orange mono text (`HYPHENATE COVERS: 5 OF 8 DUTIES`). Baseline bar: white, grey border, muted mono text. Thin vertical gridlines, mono axis numbers |
| Progress | Segmented bars, green for done; ring charts in `--accent` with `--accent-soft` remainder |
| Status chip | Mono uppercase with a coloured dot, e.g. `● MATCHING TO PRODUCTS` |
| Step counter | Orange `01 —— 05` style, for the live demo's steps |

**Duty highlight colours** (posting view): covered = `--success-soft` fill with a green underline; assisted = `--accent-soft` fill with an orange underline; human, gap and unclear = no fill with a dotted `--ink-muted` underline.

**Copy tone.** Short declarative sentences with full stops, sentence case. Headlines state a finding: "Most of an AR specialist's week is already automatable."

**Branding rules.** Use the look, not the identity. Give the product its own wordmark, "Before the Next Hire", set in the display font in `--ink-display`. Do not use Hyphenate's logo mark, its wordmark, customer logos, its 3D imagery, or its notched "Book a Call" button. Mention Hyphenate only as the subject of the analysis.

## Milestones, testing and limits

Eight milestones, each ending in a review with the user. Pipeline quality is proven on hand-labelled postings before any UI work starts.

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Setup: repo, config files, design tokens, Claude client with caching | `npm run dev` shows an empty shell in the design system; `npm test` passes |
| M1 | Extraction on fixtures | 10 hand-labelled postings in `tests/fixtures/` (the user labels them with Claude Code's help); schema valid 10 of 10; duty count within 1 of the hand label for 8 of 10; salary parsed exactly |
| M2 | Matching on fixtures | Label agreement with hand labels of at least 80%; no covered or assisted label without a capability id |
| M3 | Collection | At least 150 postings from at least 40 companies after filtering and dedupe, each with `source_url`; a short collection report |
| M4 | Full pipeline | Scores, news, gaps and briefs for the whole set; every lead score breakdown adds up; every brief passes its fact check; every uncovered duty sits in exactly one gap theme; a cost report per stage |
| M5 | Dashboard | All 8 routes; every number links to its evidence; sliders recompute instantly; works at 375 px width; side-by-side review against the site screenshots |
| M6 | Live demo | Both sample postings return in under 30 seconds; rate limits work; pasted text never appears in logs |
| M7 | Polish and findings | `/method` complete; CSV exports; `FINDINGS.md` with three headline numbers computed from the data; `README.md` with run steps and limits |

**Tests**

- Unit tests for every formula, including edge cases: no salary, hourly pay, single-figure salary, thin postings, zero duties, a company with no triggers.
- Schema tests for every Claude output type.
- Golden tests: the 10 fixtures rerun on every prompt change, with agreement reported.
- Stage snapshots: record counts in and out of each stage so silent drops are caught.
- A spot check of 20 random duty labels per full run, with results noted in `DECISIONS.md`.
- Token and dollar usage logged per stage.

**Known limits** (show these on `/method`)

- A posting shows pain and intent to hire, not budget or the real day-to-day work.
- Duties are not weighted by time spent; the 50% discount stands in for that.
- The coverage map is a reading of Hyphenate's public site and needs checking with Hyphenate.
- Public job boards over-represent tech and venture-backed companies.
- Salary data exists only where postings list it, mostly in states that require ranges.
- Model labels can be wrong; confidence scores and the evidence view let people check.
