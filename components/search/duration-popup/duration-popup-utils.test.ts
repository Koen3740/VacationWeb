import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DURATION_CHIPS,
  DURATION_MAX,
  DURATION_MIN,
  clearDurationDraft,
  durationDaysFromDraft,
  durationDraftFromApplied,
  formatSelectedDurationsLabel,
  sameDurationSelection,
  stepCustomDurationDraft,
  suggestCustomDuration,
  toggleCustomDurationDraft,
  toggleDuration,
  toggleDurationChipDraft,
  type DurationChip,
} from './duration-popup-utils';

function chip(id: string): DurationChip {
  const found = DURATION_CHIPS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`missing chip ${id}`);
  }
  return found;
}

test('toggleDuration supports multi-select accumulation', () => {
  let selected: number[] = [];
  for (const days of [8, 9, 10, 11, 12]) {
    selected = toggleDuration(selected, days);
  }
  assert.deepEqual(selected, [8, 9, 10, 11, 12]);
  assert.equal(formatSelectedDurationsLabel(selected), '8–12 dagen');
});

test('toggleDuration can deselect without clearing others', () => {
  const selected = toggleDuration([8, 9, 10], 9);
  assert.deepEqual(selected, [8, 10]);
});

test('duration chips match the common trip lengths and write nights lists', () => {
  assert.deepEqual(
    DURATION_CHIPS.map((item) => item.label),
    ['3–4', '5–6', '8', '10–11', '15', '22 dagen'],
  );
  assert.deepEqual(DURATION_CHIPS.map((item) => [...item.days]), [[3, 4], [5, 6], [8], [10, 11], [15], [22]]);
});

test('empty duration opens on 8, and OPSLAAN would commit it', () => {
  const draft = durationDraftFromApplied([]);
  assert.deepEqual(draft.chipIds, ['8']);
  assert.equal(draft.customOpen, false);
  assert.deepEqual(durationDaysFromDraft(draft), [8]);
  assert.equal(sameDurationSelection(durationDaysFromDraft(draft), []), false);
});

test('applied 8 is already selected and an untouched save does not change it', () => {
  const draft = durationDraftFromApplied([8]);
  assert.deepEqual(durationDaysFromDraft(draft), [8]);
  assert.equal(sameDurationSelection(durationDaysFromDraft(draft), [8]), true);
});

test('chips multi-select as a union of nights lists', () => {
  let draft = durationDraftFromApplied([]);
  draft = toggleDurationChipDraft(draft, chip('8'));
  draft = toggleDurationChipDraft(draft, chip('15'));
  draft = toggleDurationChipDraft(draft, chip('3-4'));
  assert.deepEqual(durationDaysFromDraft(draft), [3, 4, 15]);
  assert.equal(formatSelectedDurationsLabel(durationDaysFromDraft(draft)), '3–4, 15 dagen');
  draft = toggleDurationChipDraft(draft, chip('8'));
  assert.deepEqual(durationDaysFromDraft(draft), [3, 4, 8, 15]);
});

test('Ander aantal adds one custom day between 2 and 32 and closing removes it', () => {
  let draft = durationDraftFromApplied([8]);
  assert.equal(suggestCustomDuration(['8']), 9);
  draft = toggleCustomDurationDraft(draft);
  assert.equal(draft.customOpen, true);
  assert.equal(draft.customDay, 9);
  assert.deepEqual(durationDaysFromDraft(draft), [8, 9]);
  draft = stepCustomDurationDraft(draft, 30);
  assert.equal(draft.customDay, DURATION_MAX);
  draft = stepCustomDurationDraft(draft, -100);
  assert.equal(draft.customDay, DURATION_MIN);
  assert.deepEqual(durationDaysFromDraft(draft), [2, 8]);
  draft = toggleCustomDurationDraft(draft);
  assert.equal(draft.customOpen, false);
  assert.deepEqual(durationDaysFromDraft(draft), [8]);
});

test('a lone custom day such as 9 opens the stepper and is not widened', () => {
  const draft = durationDraftFromApplied([9]);
  assert.deepEqual(draft.chipIds, []);
  assert.equal(draft.customOpen, true);
  assert.equal(draft.customDay, 9);
  assert.deepEqual(durationDaysFromDraft(draft), [9]);
});

test('legacy non-chip lists stay intact until the user picks a chip', () => {
  const draft = durationDraftFromApplied([7, 14]);
  assert.equal(draft.legacyDays !== null, true);
  assert.deepEqual(durationDaysFromDraft(draft), [7, 14]);
  assert.equal(sameDurationSelection(durationDaysFromDraft(draft), [7, 14]), true);
  const replaced = toggleDurationChipDraft(draft, chip('15'));
  assert.equal(replaced.legacyDays, null);
  assert.deepEqual(durationDaysFromDraft(replaced), [15]);
});

test('Wissen clears every duration', () => {
  const cleared = clearDurationDraft();
  assert.deepEqual(durationDaysFromDraft(cleared), []);
  assert.equal(formatSelectedDurationsLabel(durationDaysFromDraft(cleared)), 'Reisduur');
});
