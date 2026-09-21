/**
 * Focused unit tests for Build 02/03 Discover pool/slots/failsafe/persistence.
 * Run via: scripts/run-discover-build02-test.mjs / run-discover-build03-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { applyPhasedSlotUpdates } from './apply-phased-slot-updates';
import {
  getDiscoverPool,
  isDiscoverDestinationRenderable,
} from './discover-pool';
import { getHomepageDiscoverDestinations } from './get-homepage-discover-destinations';
import { HOMEPAGE_DISCOVER_DESTINATIONS } from './homepage-discover-destinations';
import {
  loadHomepageDiscoverSlotState,
  saveHomepageDiscoverSlotState,
} from './homepage-discover-slot-state-io';
import { DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE } from './homepage-discover-slots';
import { resolveHomepageDiscoverSlots } from './resolve-homepage-discover-slots';
import { updateHomepageDiscoverSlots } from './update-homepage-discover-slots';
import {
  HOMEPAGE_DISCOVER_LIMIT,
  type DiscoverDestination,
  type DiscoverHomepageSlotState,
} from './types';

describe('Build 02 Discover pool / slots / failsafe', () => {
  it('pool has 4 active', () => {
    const pool = getDiscoverPool();
    assert.equal(pool.length, 4);
    assert.equal(HOMEPAGE_DISCOVER_DESTINATIONS.length, 4);
    assert.ok(pool.every((d) => isDiscoverDestinationRenderable(d)));
  });

  it('resolve returns 4 destinations (not 5)', () => {
    const resolved = resolveHomepageDiscoverSlots(
      DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
    );
    assert.equal(resolved.length, 4);
    assert.ok(resolved.length < HOMEPAGE_DISCOVER_LIMIT);
    assert.deepEqual(
      resolved.map((d) => d.destinationId),
      ['albania', 'sicily', 'crete', 'sardinia'],
    );
  });

  it('failsafe to previous when current missing/inactive', () => {
    const pool: DiscoverDestination[] = [
      ...getDiscoverPool().map((d) =>
        d.destinationId === 'albania'
          ? { ...d, status: 'draft' as const }
          : { ...d },
      ),
    ];
    const state: DiscoverHomepageSlotState = {
      slots: [
        {
          slotIndex: 0,
          destinationId: 'albania',
          previousDestinationId: 'sicily',
        },
        {
          slotIndex: 1,
          destinationId: 'crete',
          previousDestinationId: 'crete',
        },
        { slotIndex: 2, destinationId: null, previousDestinationId: null },
        { slotIndex: 3, destinationId: null, previousDestinationId: null },
        { slotIndex: 4, destinationId: null, previousDestinationId: null },
      ],
    };
    const resolved = resolveHomepageDiscoverSlots(state, pool);
    assert.equal(resolved[0].destinationId, 'sicily');
    assert.equal(resolved[1].destinationId, 'crete');
    assert.equal(resolved.length, 2);
  });

  it('skips slot when both current and previous missing (no ghost card)', () => {
    const state: DiscoverHomepageSlotState = {
      slots: [
        {
          slotIndex: 0,
          destinationId: 'missing-a',
          previousDestinationId: 'missing-b',
        },
        {
          slotIndex: 1,
          destinationId: 'crete',
          previousDestinationId: 'crete',
        },
        { slotIndex: 2, destinationId: null, previousDestinationId: null },
        { slotIndex: 3, destinationId: null, previousDestinationId: null },
        { slotIndex: 4, destinationId: null, previousDestinationId: null },
      ],
    };
    const resolved = resolveHomepageDiscoverSlots(state);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].destinationId, 'crete');
  });

  it('applyPhasedSlotUpdates rejects replacing all filled slots at once', () => {
    const result = applyPhasedSlotUpdates(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE, [
      { slotIndex: 0, destinationId: 'sicily' },
      { slotIndex: 1, destinationId: 'albania' },
      { slotIndex: 2, destinationId: 'sardinia' },
      { slotIndex: 3, destinationId: 'crete' },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /Phased rotation rule/i);
    }
  });

  it('applyPhasedSlotUpdates allows replacing 1 of 4', () => {
    const result = applyPhasedSlotUpdates(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE, [
      { slotIndex: 0, destinationId: 'sardinia' },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.state.slots[0].destinationId, 'sardinia');
      assert.equal(result.state.slots[0].previousDestinationId, 'albania');
      assert.equal(result.state.slots[1].destinationId, 'sicily');
    }
  });

  it('UTF-8 names still Albanië etc.', () => {
    const result = getHomepageDiscoverDestinations({
      limit: 5,
      state: DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE,
    });
    assert.deepEqual(
      result.map((d) => d.name),
      ['Albanië', 'Sicilië', 'Kreta', 'Sardinië'],
    );
  });

  it('getter respects limit and default state', () => {
    const state = DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE;
    assert.equal(getHomepageDiscoverDestinations({ limit: 0, state }).length, 0);
    assert.equal(getHomepageDiscoverDestinations({ limit: 2, state }).length, 2);
    assert.equal(getHomepageDiscoverDestinations({ limit: 99, state }).length, 4);
  });
});

describe('Build 03 Discover slot state persistence', () => {
  it('load/save round-trip + updateHomepageDiscoverSlots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vw-b03-unit-'));
    const filePath = join(dir, 'homepage-discover-slots.json');
    saveHomepageDiscoverSlotState(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE, {
      filePath,
    });
    const loaded = loadHomepageDiscoverSlotState({ filePath });
    assert.equal(loaded.slots[0].destinationId, 'albania');

    const result = updateHomepageDiscoverSlots(
      [{ slotIndex: 0, destinationId: 'sardinia' }],
      { filePath },
    );
    assert.equal(result.ok, true);
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as DiscoverHomepageSlotState;
    assert.equal(raw.slots[0].destinationId, 'sardinia');
  });

  it('rejects destinationId not in pool without writing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vw-b03-unit-'));
    const filePath = join(dir, 'slots.json');
    saveHomepageDiscoverSlotState(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE, {
      filePath,
    });
    const result = updateHomepageDiscoverSlots(
      [{ slotIndex: 0, destinationId: 'nope' }],
      { filePath },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /destinationId not in Discover pool/);
    }
    const still = loadHomepageDiscoverSlotState({ filePath });
    assert.equal(still.slots[0].destinationId, 'albania');
  });

  it('missing file returns default clone and does not auto-write', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vw-b03-unit-'));
    const filePath = join(dir, 'missing.json');
    const loaded = loadHomepageDiscoverSlotState({ filePath });
    assert.equal(loaded.slots.length, 5);
    assert.ok(!existsSync(filePath));
    loaded.slots[0].destinationId = 'mutated';
    assert.equal(
      DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE.slots[0].destinationId,
      'albania',
    );
  });
});
