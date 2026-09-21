/**
 * AN-064 safe remediation playbooks.
 *
 * NEVER auto-change: concurrency, timeouts, circuit thresholds, architecture, or code.
 * Actions are operational acknowledgements of existing CHG-039 / S6 / DEC-011 behaviour
 * plus protective escalation when a human decision is required.
 */

import {
  appendOpsRemediation,
  getPlaybookCooldown,
  setPlaybookCooldown,
} from './store';
import type {
  OpsIncident,
  OpsZone,
  RemediationActionResult,
  RemediationLogEntry,
  RemediationPlaybookId,
} from './types';
import type { ZoneTrigger } from './zones';

export type PlaybookDefinition = {
  id: RemediationPlaybookId;
  triggerZones: OpsZone[];
  conditions: string;
  action: string;
  maxActionsPerWindow: number;
  cooldownMs: number;
  successCriterion: string;
  escalationCriterion: string;
};

export const REMEDIATION_PLAYBOOKS: PlaybookDefinition[] = [
  {
    id: 'respect_circuit_skip',
    triggerZones: ['YELLOW', 'ORANGE', 'RED'],
    conditions: 'circuit_opens ≥ 1 OR C reason includes circuit_open',
    action: 'Keep CHG-039 circuit-aware selection; do not enqueue open-circuit providers',
    maxActionsPerWindow: 1,
    cooldownMs: 60_000,
    successCriterion: 'Workset/S6 continues on healthy providers; open circuit respected',
    escalationCriterion: 'Circuit opens reach RED band without recovery',
  },
  {
    id: 'skip_missing_context',
    triggerZones: ['YELLOW', 'ORANGE', 'RED'],
    conditions: 'missing_context skips observed OR coverage deficit with skips',
    action: 'Keep CHG-039 missing-context gate; never offer missing context as live candidate',
    maxActionsPerWindow: 1,
    cooldownMs: 60_000,
    successCriterion: 'No HTTP for missing-context candidates; cursor advances',
    escalationCriterion: 'Eligible candidates collapse to zero while deficit remains',
  },
  {
    id: 'continue_s6_cursor',
    triggerZones: ['YELLOW', 'ORANGE'],
    conditions: 'coverage deficit > 0 and eligible candidates remain',
    action: 'Allow existing S6 background cursor to continue within AN-063 stop rules',
    maxActionsPerWindow: 1,
    cooldownMs: 30_000,
    successCriterion: 'presentableB increases toward 150 or valid stopReason',
    escalationCriterion: 'stopReason no_progress|max_attempts with deficit > 0',
  },
  {
    id: 'reuse_cache_b',
    triggerZones: ['YELLOW', 'ORANGE', 'GREEN'],
    conditions: 'Cached B overlays present',
    action: 'Count cache B as presentable B without new HTTP (DEC-011 / cache SSOT)',
    maxActionsPerWindow: 1,
    cooldownMs: 120_000,
    successCriterion: 'B coverage uses overlays; no duplicate HTTP for settled offers',
    escalationCriterion: 'N/A',
  },
  {
    id: 'isolate_provider_fault',
    triggerZones: ['ORANGE', 'RED'],
    conditions: 'provider_c_rate ORANGE/RED or dominant transport subtype',
    action: 'Isolate fault to provider in ops view; continue other providers; do not raise concurrency',
    maxActionsPerWindow: 1,
    cooldownMs: 120_000,
    successCriterion: 'Other providers still contribute B; faulting provider not hammered via open circuit',
    escalationCriterion: 'Overall zone stays RED after cooldown',
  },
  {
    id: 'protect_no_config_change',
    triggerZones: ['RED'],
    conditions: 'Any RED trigger',
    action: 'Protective hold: no concurrency/timeout/circuit threshold changes; escalate to owner',
    maxActionsPerWindow: 1,
    cooldownMs: 300_000,
    successCriterion: 'No autonomous config mutation; owner notified',
    escalationCriterion: 'Always escalate on RED',
  },
  {
    id: 'collect_telemetry',
    triggerZones: ['YELLOW', 'ORANGE', 'RED'],
    conditions: 'Any non-GREEN trigger',
    action: 'Persist incident story + CHG-039 ops snapshot fields for audit',
    maxActionsPerWindow: 3,
    cooldownMs: 15_000,
    successCriterion: 'Incident + remediation log entries written',
    escalationCriterion: 'N/A',
  },
];

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function selectPlaybooks(trigger: ZoneTrigger, zone: OpsZone): RemediationPlaybookId[] {
  const ids: RemediationPlaybookId[] = ['collect_telemetry'];
  if (trigger.metric === 'circuit_opens' || zone !== 'GREEN') {
    ids.push('respect_circuit_skip');
  }
  if (trigger.metric === 'coverage_deficit' || trigger.metric === 's6_no_progress' || trigger.metric === 'c_rate') {
    ids.push('continue_s6_cursor', 'skip_missing_context', 'reuse_cache_b');
  }
  if (trigger.metric === 'provider_c_rate' || trigger.metric === 'transport_subtype_share' || zone === 'ORANGE' || zone === 'RED') {
    ids.push('isolate_provider_fault');
  }
  if (zone === 'RED') {
    ids.push('protect_no_config_change');
  }
  // continue_s6 only YELLOW/ORANGE per playbook def
  return [...new Set(ids)].filter((id) => {
    const pb = REMEDIATION_PLAYBOOKS.find((p) => p.id === id);
    return pb ? pb.triggerZones.includes(zone) || (id === 'reuse_cache_b' && zone === 'GREEN') : false;
  });
}

export function runRemediationPlaybooks(args: {
  zone: OpsZone;
  triggers: ZoneTrigger[];
  incident: OpsIncident;
  simulationMode: boolean;
}): RemediationLogEntry[] {
  if (args.zone === 'GREEN') {
    return [];
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const entries: RemediationLogEntry[] = [];
  const wanted = new Set<RemediationPlaybookId>();
  for (const t of args.triggers) {
    for (const id of selectPlaybooks(t, args.zone)) {
      wanted.add(id);
    }
  }

  for (const id of wanted) {
    const pb = REMEDIATION_PLAYBOOKS.find((p) => p.id === id);
    if (!pb) {
      continue;
    }
    if (!pb.triggerZones.includes(args.zone)) {
      continue;
    }
    const cooldownKey = `${id}:${args.incident.provider ?? 'all'}`;
    const last = getPlaybookCooldown(cooldownKey);
    if (last && now - Date.parse(last) < pb.cooldownMs) {
      const skipped: RemediationLogEntry = {
        id: newId('rem'),
        timestamp: nowIso,
        playbookId: id,
        incidentId: args.incident.id,
        zone: args.zone,
        provider: args.incident.provider,
        action: pb.action,
        result: 'skipped_cooldown',
        detail: `Cooldown active until ${new Date(Date.parse(last) + pb.cooldownMs).toISOString()}`,
      };
      appendOpsRemediation(skipped);
      entries.push(skipped);
      continue;
    }

    let result: RemediationActionResult = args.simulationMode ? 'simulated' : 'applied';
    let detail = pb.action;
    if (id === 'protect_no_config_change') {
      result = args.simulationMode ? 'simulated' : 'escalated';
      detail =
        'RED protective hold: concurrency remains Corendon=8 / Sunweb=5 / Eliza=5; no timeout or circuit edits; owner escalation required for any config change.';
    } else if (id === 'continue_s6_cursor') {
      detail =
        'S6 cursor continuation is already the product path (AN-063). Ops records that refill may proceed within target_met / exhausted / max_attempts / no_progress rules.';
      result = args.simulationMode ? 'simulated' : 'already_active';
    } else if (id === 'respect_circuit_skip' || id === 'skip_missing_context' || id === 'reuse_cache_b') {
      detail = `${pb.action} (mechanism already enforced in pricing path — logged for incident trail)`;
      result = args.simulationMode ? 'simulated' : 'already_active';
    } else if (id === 'isolate_provider_fault') {
      detail = `Isolate ${args.incident.provider ?? 'affected provider'}: continue healthy providers; do not raise Sunweb concurrency (C04 reject).`;
    }

    setPlaybookCooldown(cooldownKey, nowIso);
    const entry: RemediationLogEntry = {
      id: newId('rem'),
      timestamp: nowIso,
      playbookId: id,
      incidentId: args.incident.id,
      zone: args.zone,
      provider: args.incident.provider,
      action: pb.action,
      result,
      detail,
    };
    appendOpsRemediation(entry);
    entries.push(entry);
  }

  return entries;
}

export function getPlaybookDefinitions(): PlaybookDefinition[] {
  return REMEDIATION_PLAYBOOKS.map((p) => ({ ...p }));
}
