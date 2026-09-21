/**
 * N-065.4 — provider ABC invariants + cockpit selection rebind.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearOpsSimulation,
  rebindOpsCockpitSelection,
  resetOpsSimulationStateForTests,
  runOpsSimulation,
} from '@/lib/ops/live-pricing';
import type { OpsIncident, ProviderOpsRow } from '@/lib/ops/live-pricing/types';

function assertProviderAbcInvariant(row: ProviderOpsRow): void {
  if (row.attempts <= 0) {
    assert.equal(row.b, 0);
    assert.equal(row.a, 0);
    assert.equal(row.c, 0);
    assert.equal(row.bRate, 0);
    assert.equal(row.aRate, 0);
    assert.equal(row.cRate, 0);
    return;
  }
  assert.equal(row.b + row.a + row.c, row.attempts, `${row.provider}: B+A+C must equal attempts`);
  assert.ok(Math.abs(row.bRate - row.b / row.attempts) < 1e-12, `${row.provider}: bRate`);
  assert.ok(Math.abs(row.aRate - row.a / row.attempts) < 1e-12, `${row.provider}: aRate`);
  assert.ok(Math.abs(row.cRate - row.c / row.attempts) < 1e-12, `${row.provider}: cRate`);
}

for (const scenario of ['GREEN', 'YELLOW', 'ORANGE'] as const) {
  test(`N-065.4 ${scenario} — every attempts>0 provider has B+A+C===attempts and matching rates`, () => {
    resetOpsSimulationStateForTests();
    const snap = runOpsSimulation(scenario);
    const active = snap.providers.filter((p) => p.attempts > 0);
    assert.ok(active.length >= 1);
    for (const row of active) {
      assertProviderAbcInvariant(row);
    }
    const corendon = snap.providers.find((p) => p.provider === 'Corendon');
    const sunweb = snap.providers.find((p) => p.provider === 'Sunweb');
    assert.ok(corendon);
    assert.ok(sunweb);
    assertProviderAbcInvariant(corendon!);
    assertProviderAbcInvariant(sunweb!);
    clearOpsSimulation();
  });
}

test('N-065.4 RED — Corendon + Sunweb ABC invariants', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('RED');
  for (const name of ['Corendon', 'Sunweb'] as const) {
    const row = snap.providers.find((p) => p.provider === name);
    assert.ok(row);
    assert.ok(row!.attempts > 0);
    assertProviderAbcInvariant(row!);
  }
  clearOpsSimulation();
});

test('N-065.4 Eliza attempts===0 inherits overall technical zone (existing policy)', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('ORANGE');
  const eliza = snap.providers.find((p) => p.provider === 'Eliza');
  assert.ok(eliza);
  assert.equal(eliza!.attempts, 0);
  assert.equal(eliza!.b + eliza!.a + eliza!.c, 0);
  assert.equal(eliza!.zone, snap.technicalHealthZone);
  clearOpsSimulation();
});

test('N-065.4 rebind selectedProvider to new snapshot row (card≡detail fields)', () => {
  resetOpsSimulationStateForTests();
  const yellow = runOpsSimulation('YELLOW');
  const staleCorendon = yellow.providers.find((p) => p.provider === 'Corendon');
  assert.ok(staleCorendon);

  const orange = runOpsSimulation('ORANGE');
  const rebound = rebindOpsCockpitSelection(orange, staleCorendon!, null);
  assert.ok(rebound.selectedProvider);
  assert.equal(rebound.selectedProvider!.provider, 'Corendon');
  const cardRow = orange.providers.find((p) => p.provider === 'Corendon')!;
  assert.equal(rebound.selectedProvider!.zone, cardRow.zone);
  assert.equal(rebound.selectedProvider!.attempts, cardRow.attempts);
  assert.equal(rebound.selectedProvider!.b, cardRow.b);
  assert.equal(rebound.selectedProvider!.a, cardRow.a);
  assert.equal(rebound.selectedProvider!.c, cardRow.c);
  assert.equal(rebound.selectedProvider!.bRate, cardRow.bRate);
  assert.equal(rebound.selectedProvider!.aRate, cardRow.aRate);
  assert.equal(rebound.selectedProvider!.cRate, cardRow.cRate);
  // Must not keep YELLOW-era counts after ORANGE snapshot.
  assert.notEqual(rebound.selectedProvider!.bRate, staleCorendon!.bRate);
  clearOpsSimulation();
});

test('N-065.4 rebind clears selectedProvider when provider missing', () => {
  resetOpsSimulationStateForTests();
  const snap = runOpsSimulation('GREEN');
  const ghost: ProviderOpsRow = {
    ...snap.providers[0]!,
    provider: 'DoesNotExist',
  };
  const rebound = rebindOpsCockpitSelection(snap, ghost, null);
  assert.equal(rebound.selectedProvider, null);
  clearOpsSimulation();
});

test('N-065.4 rebind selectedIncident to same id in new snapshot or clear', () => {
  resetOpsSimulationStateForTests();
  const orange = runOpsSimulation('ORANGE');
  const incident = orange.openIncidents[0] ?? orange.recentIncidents[0];
  assert.ok(incident);

  const reboundSame = rebindOpsCockpitSelection(orange, null, incident);
  assert.ok(reboundSame.selectedIncident);
  assert.equal(reboundSame.selectedIncident!.id, incident.id);

  const green = runOpsSimulation('GREEN');
  const ghost: OpsIncident = { ...incident, id: 'inc_missing_for_rebind' };
  const reboundGone = rebindOpsCockpitSelection(green, null, ghost);
  assert.equal(reboundGone.selectedIncident, null);
  clearOpsSimulation();
});
