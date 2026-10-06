import assert from 'node:assert/strict';
import test from 'node:test';
import { sortOffersNewestFirst } from './sort-offers';

function offer(id: string, dates: { publishedAt?: string | null; validFrom?: string | null; ingestedAt?: string | null }) {
  return {
    id,
    publishedAt: dates.publishedAt ?? null,
    validFrom: dates.validFrom ?? null,
    ingestedAt: dates.ingestedAt ?? null,
  };
}

test('E: a newer publish date is placed above an older one', () => {
  const sorted = sortOffersNewestFirst([
    offer('old', { publishedAt: '2026-01-01' }),
    offer('new', { publishedAt: '2026-10-01' }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['new', 'old'],
  );
});

test('E: undated offers sink under dated ones, and an equal date breaks by id descending', () => {
  const sorted = sortOffersNewestFirst([
    offer('nl:corendon:last-minutes', {}),
    offer('nl:corendon:warme-winter-weken', {}),
    offer('dated', { publishedAt: '2026-08-01' }),
    offer('same-b', { publishedAt: '2026-08-01' }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['same-b', 'dated', 'nl:corendon:warme-winter-weken', 'nl:corendon:last-minutes'],
  );
});

test('E: validity start is used when publish is missing, then ingest time', () => {
  const sorted = sortOffersNewestFirst([
    offer('ingested', { ingestedAt: '2026-08-01T00:00:00.000Z' }),
    offer('valid', { validFrom: '2026-09-01' }),
    offer('published', { publishedAt: '2026-07-01', validFrom: '2026-12-01', ingestedAt: '2026-12-02T00:00:00.000Z' }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['valid', 'ingested', 'published'],
  );
});
