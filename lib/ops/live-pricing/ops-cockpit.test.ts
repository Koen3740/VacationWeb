/**
 * AN-064 / N-065 — Live Pricing Operations Cockpit tests.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CORENDON_LIVE_MATCHSET_CONCURRENCY } from '@/lib/providers/corendon/constants';
import { ELIZA_LIVE_PAGE1_CONCURRENCY } from '@/lib/providers/eliza/constants';
import { SUNWEB_LIVE_MATCHSET_CONCURRENCY } from '@/lib/providers/sunweb/constants';
import {
  clearOpsSimulation,
  listOpsIncidents,
  listOpsRemediations,
  resetOpsSimulationStateForTests,
  runOpsSimulation,
} from '@/lib/ops/live-pricing';
import { LIVE_PRICE_C_RATE_ALARM_THRESHOLD } from '@/lib/search/live-price-observability';
import { OPS_C_RATE_ORANGE, OPS_C_RATE_RED, OPS_C_RATE_YELLOW } from '@/lib/ops/live-pricing/thresholds';
import { evaluateOpsZoneTriggers } from '@/lib/ops/live-pricing/zones';
import { resolveEvaluationInput } from '@/lib/ops/live-pricing/evaluate';

test('concurrency guard unchanged 8/5/5', () => {
  assert.equal(CORENDON_LIVE_MATCHSET_CONCURRENCY, 8);
  assert.equal(SUNWEB_LIVE_MATCHSET_CONCURRENCY, 5);
  assert.equal(ELIZA_LIVE_PAGE1_CONCURRENCY, 5);
});

test('RED C-rate threshold aligns with CHG-039 alarm', () => {
  assert.equal(OPS_C_RATE_RED, LIVE_PRICE_C_RATE_ALARM_THRESHOLD);
});

test('IDLE — no pricing signal is IDLE not GREEN 0/150', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('IDLE');
  assert.equal(snap.ownerStatus, 'IDLE');
  assert.equal(snap.coverage.presentableB, 0);
  assert.equal(snap.actionRequired.answer, 'NEE');
  assert.equal(snap.productGoalMet, false);
  clearOpsSimulation();
});

test('TEST 1 GREEN — product goal met, no action', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('GREEN');
  assert.equal(snap.ownerStatus, 'GREEN');
  assert.equal(snap.coverage.presentableB, 150);
  assert.equal(snap.coverage.deficit, 0);
  assert.equal(snap.productGoalMet, true);
  assert.equal(snap.actionRequired.answer, 'NEE');
  assert.equal(snap.openIncidents.length, 0);
  clearOpsSimulation();
});

test('TEST 2 YELLOW — ownerStatus YELLOW; cRate in [YELLOW, ORANGE)', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('YELLOW');
  assert.equal(snap.ownerStatus, 'YELLOW');
  assert.equal(snap.technicalHealthZone, 'YELLOW');
  assert.ok(snap.bac.cRate >= OPS_C_RATE_YELLOW);
  assert.ok(snap.bac.cRate < OPS_C_RATE_ORANGE);
  assert.ok(listOpsIncidents().length >= 1);
  assert.ok(listOpsRemediations().length >= 1);
  assert.equal(snap.actionRequired.answer, 'NEE');
  assert.equal(snap.notifications.length, 0);
  clearOpsSimulation();
});

test('YELLOW scenario does not fire independent ORANGE/RED triggers', () => {
  resetOpsSimulationStateForTests();
  runOpsSimulation('YELLOW');
  const triggers = evaluateOpsZoneTriggers(resolveEvaluationInput());
  assert.ok(triggers.every((t) => t.zone === 'YELLOW' || t.zone === 'GREEN'));
  assert.equal(
    triggers.some((t) => t.zone === 'ORANGE' || t.zone === 'RED'),
    false,
  );
  clearOpsSimulation();
});

test('TEST 3 ORANGE — action JA + notification', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('ORANGE');
  assert.equal(snap.ownerStatus, 'ORANGE');
  assert.equal(snap.actionRequired.answer, 'JA');
  assert.ok(snap.notifications.some((n) => n.zone === 'ORANGE' || n.zone === 'RED'));
  clearOpsSimulation();
});

test('TEST 4 RED — protect + escalate', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('RED');
  assert.equal(snap.ownerStatus, 'RED');
  assert.equal(snap.actionRequired.answer, 'JA');
  assert.ok(snap.remediations.some((r) => r.playbookId === 'protect_no_config_change'));
  assert.equal(snap.concurrencyGuard.sunweb, 5);
  clearOpsSimulation();
});

test('scenario labels match ownerStatus: GREEN→YELLOW→ORANGE→RED', () => {
  resetOpsSimulationStateForTests();
  assert.equal(runOpsSimulation('GREEN').ownerStatus, 'GREEN');
  assert.equal(runOpsSimulation('YELLOW').ownerStatus, 'YELLOW');
  assert.equal(runOpsSimulation('ORANGE').ownerStatus, 'ORANGE');
  assert.equal(runOpsSimulation('RED').ownerStatus, 'RED');
  clearOpsSimulation();
});

test('120/150 matchset_exhausted is not GREEN — coverage shortfall', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('CUSTOM', {
    scenario: 'CUSTOM',
    attempts: 80,
    b: 60,
    a: 10,
    c: 2,
    presentableB: 120,
    s6StopReason: 'matchset_exhausted',
    circuitOpens: 0,
  });
  assert.notEqual(snap.ownerStatus, 'GREEN');
  assert.notEqual(snap.ownerStatus, 'IDLE');
  assert.equal(snap.productGoalMet, false);
  assert.ok(snap.coverage.deficit === 30);
  assert.ok(
    listOpsIncidents().some((i) => i.metric === 'coverage_deficit' || i.metric === 's6_no_progress'),
  );
  clearOpsSimulation();
});

test('0/150 with S6 stop is not GREEN', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('CUSTOM', {
    scenario: 'CUSTOM',
    attempts: 40,
    b: 0,
    a: 10,
    c: 5,
    presentableB: 0,
    s6StopReason: 'matchset_exhausted',
    circuitOpens: 0,
  });
  assert.notEqual(snap.ownerStatus, 'GREEN');
  assert.equal(snap.coverage.presentableB, 0);
  assert.equal(snap.productGoalMet, false);
  clearOpsSimulation();
});

test('50/150 and 150/150 coverage cases', () => {
  resetOpsSimulationStateForTests();
  let snap = runOpsSimulation('CUSTOM', {
    scenario: 'CUSTOM',
    attempts: 60,
    b: 40,
    a: 10,
    c: 2,
    presentableB: 50,
    s6StopReason: 'no_progress',
    circuitOpens: 0,
  });
  assert.equal(snap.coverage.presentableB, 50);
  assert.ok(snap.ownerStatus === 'ORANGE' || snap.ownerStatus === 'YELLOW');
  snap = runOpsSimulation('GREEN');
  assert.equal(snap.coverage.presentableB, 150);
  assert.equal(snap.ownerStatus, 'GREEN');
  clearOpsSimulation();
});

test('S6 active filling toward 150 can be technically GREEN with goal unmet', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('CUSTOM', {
    scenario: 'CUSTOM',
    attempts: 40,
    b: 30,
    a: 5,
    c: 1,
    presentableB: 80,
    s6Active: true,
    s6StopReason: null,
    circuitOpens: 0,
  });
  assert.equal(snap.coverage.s6Active, true);
  assert.equal(snap.productGoalMet, false);
  assert.equal(snap.ownerStatus, 'GREEN');
  assert.match(snap.actionRequired.detail, /S6/i);
  clearOpsSimulation();
});

test('Coverage shortfall does not AUTO-RESOLVE on technical recovery alone', () => {
  resetOpsSimulationStateForTests();
  runOpsSimulation('CUSTOM', {
    scenario: 'CUSTOM',
    attempts: 80,
    b: 60,
    a: 10,
    c: 2,
    presentableB: 120,
    s6StopReason: 'matchset_exhausted',
    circuitOpens: 0,
  });
  const openBefore = listOpsIncidents().filter(
    (i) =>
      (i.status === 'OPEN' || i.status === 'ESCALATED') &&
      (i.metric === 'coverage_deficit' || i.metric === 's6_no_progress'),
  );
  assert.ok(openBefore.length >= 1);
  // Technical C still quiet, but coverage still short — stay open
  runOpsSimulation('CUSTOM', {
    scenario: 'CUSTOM',
    attempts: 80,
    b: 70,
    a: 8,
    c: 2,
    presentableB: 120,
    s6StopReason: 'matchset_exhausted',
    circuitOpens: 0,
  });
  const stillOpen = listOpsIncidents().filter(
    (i) =>
      (i.status === 'OPEN' || i.status === 'ESCALATED') &&
      (i.metric === 'coverage_deficit' || i.metric === 's6_no_progress'),
  );
  assert.ok(stillOpen.length >= 1, 'coverage incident must remain open until 150 B');
  clearOpsSimulation();
});

test('YELLOW technical → AUTO-RESOLVED when GREEN with 150 B', () => {
  resetOpsSimulationStateForTests();
  runOpsSimulation('YELLOW');
  assert.ok(listOpsIncidents().some((i) => i.status === 'OPEN' || i.status === 'ESCALATED'));
  const snap = runOpsSimulation('GREEN');
  assert.equal(snap.ownerStatus, 'GREEN');
  assert.ok(listOpsIncidents().some((i) => i.status === 'AUTO-RESOLVED'));
  clearOpsSimulation();
});

test('24h incident counts and hourly buckets exist', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('ORANGE');
  assert.ok(snap.incidentsLast24h.total >= 1);
  assert.ok(snap.hourlyIncidents24h.length >= 24);
  assert.ok(snap.hourlyIncidents24h.length <= 25);
  assert.equal(snap.incidentView24h.counts.total, snap.incidentsLast24h.total);
  const timelineTotal = snap.incidentView24h.timeline.reduce(
    (s, b) => s + b.GREEN + b.YELLOW + b.ORANGE + b.RED,
    0,
  );
  assert.equal(timelineTotal, snap.incidentView24h.counts.total);
  assert.ok(snap.incidentCountRule.includes('startedAt'));
  clearOpsSimulation();
});

test('C-subtype UND_ERR_CONNECT_TIMEOUT visible', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('YELLOW');
  assert.ok(snap.cSubtypes.some((s) => s.code === 'UND_ERR_CONNECT_TIMEOUT'));
  clearOpsSimulation();
});
