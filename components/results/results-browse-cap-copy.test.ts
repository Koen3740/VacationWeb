import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  RESULTS_BROWSE_CAP_BODY,
  RESULTS_BROWSE_CAP_TITLE,
} from '@/components/results/results-refinement-required';

describe('exact max-150 Prijsvrij copy', () => {
  it('uses the two required sentences and nothing extra', () => {
    assert.equal(
      RESULTS_BROWSE_CAP_TITLE,
      'We kunnen je helaas maar maximaal 150 resultaten tonen',
    );
    assert.equal(
      RESULTS_BROWSE_CAP_BODY,
      'Gebruik de filters aan de linkerkant om je zoekopdracht te verfijnen en zo jouw top vakantie te vinden.',
    );
    const src = readFileSync('components/results/results-refinement-required.tsx', 'utf8');
    assert.match(src, /RESULTS_BROWSE_CAP_TITLE/);
    assert.match(src, /RESULTS_BROWSE_CAP_BODY/);
    assert.doesNotMatch(src, /Pas zoekopdracht aan/);
    assert.doesNotMatch(src, /Er kunnen maximaal 150 resultaten worden getoond/);
    assert.doesNotMatch(src, /Maak je zoekopdracht iets specifieker/);
  });

  it('page 15 Volgende still opens the existing refine dialog with this copy', () => {
    const ui = readFileSync('components/results/results-pagination.tsx', 'utf8');
    assert.match(ui, /resultsNextControlKind/);
    assert.match(ui, /nextKind === 'browse-cap'/);
    assert.match(ui, /ResultsRefinementRequired/);
    assert.match(ui, /results-browse-cap-dialog/);
    assert.doesNotMatch(ui, /goToPage\(16\)/);
  });
});
