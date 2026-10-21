# Collection report

Run on 2026-10-21. Sources: public Greenhouse, Lever and Ashby job-board APIs only.

| Step | Count |
| --- | --- |
| Seed companies (config/sources.csv) | 102 |
| Jobs seen on their boards | 9236 |
| Finance-title candidates stored | 295 |
| Kept after filter and dedupe | 152 |
| Companies with at least one kept posting | 94 |
| Kept postings with a salary in text or board data | 137 |

**Filter drops:** dropped 39: not US; dropped 62: older than 60 days; dropped 25: unclear title, not checked (no API key); dropped 17: duplicate (merged).

**By source:** ashby 48, greenhouse 93, lever 11. Every record keeps `source_url` and `fetched_at`.

**Posting dates:** 2026-08-21 to 2026-10-20 (first-published date from each board).

**Board errors:** none.

**Companies with the most kept postings:** Samsara (6), Oscar Health (5), Oura (5), Saronic (4), Fivetran (4), Reddit (4), Relativity Space (4), Applied Intuition (3), Headway (3), Notion (3), Perplexity (3), Roofstock (3).

## Known gaps

- dropped 25: unclear title, not checked (no API key). With an API key the filter sends these titles to a Claude check, which may add a few postings.
- Employee bands in the seed list are unverified estimates (see DECISIONS.md).
- Public job boards over-represent venture-backed technology companies; FP&A roles are a large share of what they list.
