/**
 * N-065.1 — canonical incident aggregates + period consistency.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyCockpitIncidentViewFilters,
  buildIncidentPeriodAggregate,
  sumTimelineCounts,
} from '@/lib/ops/live-pricing/aggregates';
import type { OpsIncident, OpsZone } from '@/lib/ops/live-pricing/types';
import {
  clearOpsStoreForTests,
  upsertOpsIncident,
} from '@/lib/ops/live-pricing/store';
import {
  getLivePricingCockpitSnapshot,
  resetOpsSimulationStateForTests,
  runOpsSimulation,
  clearOpsSimulation,
} from '@/lib/ops/live-pricing';

function makeIncident(args: {
  id: string;
  zone: OpsZone;
  startedAt: string;
  status?: OpsIncident['status'];
}): OpsIncident {
  return {
    id: args.id,
    startedAt: args.startedAt,
    endedAt: args.status === 'AUTO-RESOLVED' ? args.startedAt : null,
    zoneAtDetection: args.zone,
    currentZone: args.zone,
    metric: 'c_rate',
    actualValue: 0.3,
    threshold: 0.25,
    provider: 'Sunweb',
    cSubtype: null,
    attempts: 20,
    bCount: 5,
    aCount: 5,
    cCount: 10,
    coveragePresentableB: 50,
    coverageTargetB: 150,
    cause: `test ${args.zone}`,
    autoAction: 'collect_telemetry:applied',
    actionAt: args.startedAt,
    actionResult: 'applied',
    recoveryDurationMs: args.status === 'AUTO-RESOLVED' ? 1000 : null,
    escalated: args.zone === 'RED',
    notified: args.zone === 'ORANGE' || args.zone === 'RED',
    status: args.status ?? 'OPEN',
    story: [`${args.startedAt} DETECT`],
  };
}

test('TEST A — 0 incidents → counts 0, empty timeline, empty state totals', () => {
  const now = Date.parse('2026-09-20T20:00:00.000Z');
  const agg = buildIncidentPeriodAggregate([], '24h', now);
  assert.equal(agg.counts.total, 0);
  assert.equal(sumTimelineCounts(agg.timeline).total, 0);
  assert.equal(agg.incidents.length, 0);
});

test('TEST B — 4Y+4O+2R → counts/donut/timeline all 10 with matching zones', () => {
  const now = Date.parse('2026-09-20T20:30:00.000Z');
  const incidents: OpsIncident[] = [];
  for (let i = 0; i < 4; i += 1) {
    incidents.push(
      makeIncident({
        id: `y${i}`,
        zone: 'YELLOW',
        startedAt: new Date(now - i * 60_000).toISOString(),
      }),
    );
  }
  for (let i = 0; i < 4; i += 1) {
    incidents.push(
      makeIncident({
        id: `o${i}`,
        zone: 'ORANGE',
        startedAt: new Date(now - (10 + i) * 60_000).toISOString(),
      }),
    );
  }
  for (let i = 0; i < 2; i += 1) {
    incidents.push(
      makeIncident({
        id: `r${i}`,
        zone: 'RED',
        startedAt: new Date(now - (20 + i) * 60_000).toISOString(),
        status: 'ESCALATED',
      }),
    );
  }
  const agg = buildIncidentPeriodAggregate(incidents, '24h', now);
  assert.equal(agg.counts.YELLOW, 4);
  assert.equal(agg.counts.ORANGE, 4);
  assert.equal(agg.counts.RED, 2);
  assert.equal(agg.counts.total, 10);
  const timelineSum = sumTimelineCounts(agg.timeline);
  assert.deepEqual(timelineSum, agg.counts);
  assert.equal(agg.incidents.length, 10);
});

test('TEST C — multi-hour distribution buckets correctly', () => {
  const now = Date.parse('2026-09-20T20:15:00.000Z');
  const incidents = [
    makeIncident({ id: 'h0', zone: 'RED', startedAt: '2026-09-20T20:10:00.000Z' }),
    makeIncident({ id: 'h1', zone: 'YELLOW', startedAt: '2026-09-20T19:05:00.000Z' }),
    makeIncident({ id: 'h2', zone: 'ORANGE', startedAt: '2026-09-20T18:50:00.000Z' }),
  ];
  const agg = buildIncidentPeriodAggregate(incidents, '24h', now);
  assert.equal(agg.counts.total, 3);
  assert.equal(sumTimelineCounts(agg.timeline).total, 3);
  const withRed = agg.timeline.find((b) => b.RED > 0);
  const withYellow = agg.timeline.find((b) => b.YELLOW > 0);
  const withOrange = agg.timeline.find((b) => b.ORANGE > 0);
  assert.ok(withRed, 'RED in current hour bucket');
  assert.ok(withYellow);
  assert.ok(withOrange);
  assert.notEqual(withRed!.hourStart, withYellow!.hourStart);
});

test('TEST D — AUTO-RESOLVED stays in period aggregate', () => {
  const now = Date.parse('2026-09-20T20:00:00.000Z');
  const incidents = [
    makeIncident({
      id: 'ar1',
      zone: 'RED',
      startedAt: '2026-09-20T19:00:00.000Z',
      status: 'AUTO-RESOLVED',
    }),
    makeIncident({
      id: 'ar2',
      zone: 'YELLOW',
      startedAt: '2026-09-20T18:00:00.000Z',
      status: 'AUTO-RESOLVED',
    }),
  ];
  const agg = buildIncidentPeriodAggregate(incidents, '24h', now);
  assert.equal(agg.counts.RED, 1);
  assert.equal(agg.counts.YELLOW, 1);
  assert.equal(sumTimelineCounts(agg.timeline).RED, 1);
});

test('TEST E/F — 24h vs 7d filters use distinct windows; counts≡timeline', () => {
  const now = Date.parse('2026-09-20T12:00:00.000Z');
  const incidents = [
    makeIncident({ id: 'recent', zone: 'ORANGE', startedAt: '2026-09-20T10:00:00.000Z' }),
    makeIncident({ id: 'old', zone: 'RED', startedAt: '2026-09-15T10:00:00.000Z' }),
  ];
  const d24 = buildIncidentPeriodAggregate(incidents, '24h', now);
  const d7 = buildIncidentPeriodAggregate(incidents, '7d', now);
  assert.equal(d24.counts.total, 1);
  assert.equal(d24.counts.ORANGE, 1);
  assert.equal(d24.counts.RED, 0);
  assert.deepEqual(sumTimelineCounts(d24.timeline), d24.counts);
  assert.equal(d7.counts.total, 2);
  assert.equal(d7.counts.RED, 1);
  assert.equal(d7.timelineGranularity, 'day');
  assert.deepEqual(sumTimelineCounts(d7.timeline), d7.counts);
});

test('provider/zone view filters share one dataset for counts, timeline, and list', () => {
  const now = Date.parse('2026-09-20T20:00:00.000Z');
  const incidents = [
    makeIncident({ id: 'y-sun', zone: 'YELLOW', startedAt: '2026-09-20T19:00:00.000Z' }),
    makeIncident({ id: 'o-sun', zone: 'ORANGE', startedAt: '2026-09-20T18:00:00.000Z' }),
    {
      ...makeIncident({ id: 'r-cor', zone: 'RED', startedAt: '2026-09-20T17:00:00.000Z' }),
      provider: 'Corendon',
    },
  ];
  const periodView = buildIncidentPeriodAggregate(incidents, '24h', now);
  assert.equal(periodView.counts.total, 3);

  const byProvider = applyCockpitIncidentViewFilters(periodView, {
    provider: 'Sunweb',
    zone: 'ALL',
  });
  assert.equal(byProvider.incidents.length, 2);
  assert.equal(byProvider.counts.total, 2);
  assert.equal(byProvider.counts.YELLOW, 1);
  assert.equal(byProvider.counts.ORANGE, 1);
  assert.equal(byProvider.counts.RED, 0);
  assert.deepEqual(sumTimelineCounts(byProvider.timeline), byProvider.counts);
  assert.deepEqual(
    byProvider.incidents.map((i) => i.id).sort(),
    ['o-sun', 'y-sun'],
  );

  const byZone = applyCockpitIncidentViewFilters(periodView, {
    provider: 'ALL',
    zone: 'RED',
  });
  assert.equal(byZone.incidents.length, 1);
  assert.equal(byZone.counts.RED, 1);
  assert.equal(byZone.counts.total, 1);
  assert.deepEqual(sumTimelineCounts(byZone.timeline), byZone.counts);
  assert.equal(byZone.incidents[0]?.id, 'r-cor');

  const both = applyCockpitIncidentViewFilters(periodView, {
    provider: 'Sunweb',
    zone: 'YELLOW',
  });
  assert.equal(both.incidents.length, 1);
  assert.equal(both.counts.YELLOW, 1);
  assert.equal(both.counts.total, 1);
  assert.deepEqual(sumTimelineCounts(both.timeline), both.counts);
});

test('current-hour RED incidents are not dropped from timeline (N-065.1 root cause)', () => {
  // Root cause: old bucketing ended at floor(now-24h)+24h, excluding the current partial hour.
  const now = Date.parse('2026-09-20T20:45:00.000Z');
  const incidents = [
    makeIncident({ id: 'red-now', zone: 'RED', startedAt: '2026-09-20T20:40:00.000Z' }),
    makeIncident({ id: 'red-now-2', zone: 'RED', startedAt: '2026-09-20T20:42:00.000Z' }),
  ];
  const agg = buildIncidentPeriodAggregate(incidents, '24h', now);
  assert.equal(agg.counts.RED, 2);
  assert.equal(sumTimelineCounts(agg.timeline).RED, 2);
});

test('snapshot incidentView24h counts match timeline (integration)', () => {
  resetOpsSimulationStateForTests();
  clearOpsStoreForTests();
  const now = Date.now();
  upsertOpsIncident(
    makeIncident({
      id: 'snap-r1',
      zone: 'RED',
      startedAt: new Date(now - 60_000).toISOString(),
      status: 'ESCALATED',
    }),
  );
  upsertOpsIncident(
    makeIncident({
      id: 'snap-r2',
      zone: 'RED',
      startedAt: new Date(now - 120_000).toISOString(),
      status: 'AUTO-RESOLVED',
    }),
  );
  // Force GREEN sim so evaluate does not flood new incidents, then re-check seeded ones remain
  runOpsSimulation('GREEN');
  const snap = getLivePricingCockpitSnapshot();
  assert.ok(snap.incidentView24h);
  assert.equal(snap.incidentView24h.counts.RED, sumTimelineCounts(snap.incidentView24h.timeline).RED);
  assert.ok(snap.incidentView24h.counts.RED >= 2);
  assert.equal(snap.incidentView24h.incidents.filter((i) => i.zoneAtDetection === 'RED').length, snap.incidentView24h.counts.RED);
  clearOpsSimulation();
  clearOpsStoreForTests();
});
