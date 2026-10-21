import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../pipeline/lib/fixtures';
import { loadCoverage, coverageIndex } from '../pipeline/lib/coverage';
import { locateSpan } from '../pipeline/lib/text';
import { computeOverlap, minimumSavings } from '../lib/scoring';
import { ExtractionOutputSchema } from '../lib/schemas';

const fixtures = loadFixtures();
const { ids } = coverageIndex(loadCoverage());

describe('golden fixtures', () => {
  it('has 10 fixtures', () => expect(fixtures).toHaveLength(10));
  for (const fx of fixtures) {
    describe(fx.fixture_id, () => {
      it('every hand span is verbatim in the frozen posting text', () => {
        for (const d of fx.expected.duties) expect(locateSpan(fx.input.text, d.source_span), d.source_span).not.toBeNull();
      });
      it('covered/assisted hand labels carry a valid capability id', () => {
        for (const d of fx.expected.duties) if (d.label === 'covered' || d.label === 'assisted') expect(ids.has(d.capability_id!)).toBe(true);
      });
      it('hand labels produce deterministic scores', () => {
        const o = computeOverlap(fx.expected.duties.map((d) => ({ duty_id: d.duty_id, label: d.label, capability_id: d.capability_id })));
        expect(o.n).toBe(fx.expected.scored_duty_count);
        const s = minimumSavings({ salary_min: fx.expected.salary_annual.min, salary_max: fx.expected.salary_annual.max, n: o.n, C: o.C, A: o.A });
        if (fx.expected.salary_annual.min === null) expect(s.eligible).toBe(false);
        else expect(s.eligible && s.value).toBeCloseTo(fx.expected.salary_annual.min * (o.C / o.n) * 0.5);
      });
      it('expected fields fit the extraction enums', () => {
        const shape = ExtractionOutputSchema.shape;
        expect(shape.role_family.safeParse(fx.expected.role_family).success).toBe(true);
        expect(shape.seniority.safeParse(fx.expected.seniority).success).toBe(true);
      });
    });
  }
});
