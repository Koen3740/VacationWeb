/**
 * AN-064 notification abstraction.
 *
 * Investigated channels (no fictional availability):
 * - console: ALWAYS available (process logs)
 * - email: NOT wired — no SMTP/SendGrid/Resend deps or env in repo
 * - sms: NOT wired — no Twilio/MessageBird deps or env
 * - whatsapp: NOT wired — no WhatsApp Business API credentials / Meta Cloud API config
 * - web_push: NOT wired — no VAPID / service-worker push setup
 *
 * ORANGE/RED notifications always record to alert history; console delivers.
 * Other channels remain ready behind env flags once credentials exist.
 */

import { appendOpsNotification } from './store';
import type {
  NotificationChannelStatus,
  NotificationRecord,
  OpsIncident,
  OpsZone,
} from './types';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getNotificationChannelStatuses(): NotificationChannelStatus[] {
  const emailConfigured = Boolean(
    process.env.OPS_ALERT_EMAIL_TO && process.env.OPS_ALERT_EMAIL_PROVIDER,
  );
  const smsConfigured = Boolean(process.env.OPS_ALERT_SMS_TO && process.env.OPS_ALERT_SMS_PROVIDER);
  const waConfigured = Boolean(
    process.env.OPS_ALERT_WHATSAPP_TO &&
      process.env.OPS_ALERT_WHATSAPP_TOKEN &&
      process.env.OPS_ALERT_WHATSAPP_PHONE_ID,
  );
  const pushConfigured = Boolean(process.env.OPS_ALERT_VAPID_PUBLIC_KEY);

  return [
    {
      id: 'console',
      available: true,
      live: true,
      missing: [],
      notes: 'Always-on process log; distinctive [live-pricing-ops-ALERT] prefix for ORANGE/RED.',
    },
    {
      id: 'email',
      available: emailConfigured,
      live: false,
      missing: emailConfigured
        ? []
        : ['OPS_ALERT_EMAIL_TO', 'OPS_ALERT_EMAIL_PROVIDER', 'provider API credentials'],
      notes: 'No email SDK in package.json. Abstraction records intent; delivery requires human wiring.',
    },
    {
      id: 'sms',
      available: smsConfigured,
      live: false,
      missing: smsConfigured ? [] : ['OPS_ALERT_SMS_TO', 'OPS_ALERT_SMS_PROVIDER', 'provider credentials'],
      notes: 'No SMS provider integrated. Owner already receives many SMS — channel optional.',
    },
    {
      id: 'whatsapp',
      available: waConfigured,
      live: false,
      missing: waConfigured
        ? []
        : [
            'OPS_ALERT_WHATSAPP_TO',
            'OPS_ALERT_WHATSAPP_TOKEN',
            'OPS_ALERT_WHATSAPP_PHONE_ID',
            'Meta WhatsApp Business Cloud API app',
          ],
      notes:
        'WhatsApp Business API is not configured. Do not pretend live. Simulation records message body only.',
    },
    {
      id: 'web_push',
      available: pushConfigured,
      live: false,
      missing: pushConfigured ? [] : ['OPS_ALERT_VAPID_PUBLIC_KEY', 'OPS_ALERT_VAPID_PRIVATE_KEY', 'push subscription store'],
      notes: 'No web-push dependency or service worker alert path in this repo.',
    },
  ];
}

function formatAlertBody(incident: OpsIncident, zone: OpsZone, remediations: string[]): string {
  return [
    `Incident: ${incident.id}`,
    `Zone: ${zone}`,
    `Provider: ${incident.provider ?? 'overall'}`,
    `Metric: ${incident.metric}`,
    `Actual: ${incident.actualValue}`,
    `Threshold: ${incident.threshold}`,
    `Cause: ${incident.cause ?? 'unknown'}`,
    `B/A/C: ${incident.bCount}/${incident.aCount}/${incident.cCount} (attempts=${incident.attempts})`,
    `Coverage: ${incident.coveragePresentableB}/${incident.coverageTargetB} B`,
    `Auto action: ${incident.autoAction ?? 'none'}`,
    `Remediation: ${remediations.join(' | ') || 'none'}`,
    `Owner action: ${
      zone === 'RED'
        ? 'Review provider health; do NOT raise Sunweb concurrency; decide if human config change needed.'
        : zone === 'ORANGE'
          ? 'Monitor cockpit; verify remediation result; escalate if zone persists.'
          : 'No action required if AUTO-RESOLVED.'
    }`,
  ].join('\n');
}

/**
 * Notify owner for ORANGE/RED. YELLOW never notifies (even if open).
 * Returns whether any notification was attempted for the incident.
 */
export function notifyOwnerForIncident(args: {
  incident: OpsIncident;
  zone: OpsZone;
  remediationSummaries: string[];
  simulationMode: boolean;
}): { notified: boolean; records: NotificationRecord[] } {
  if (args.zone !== 'ORANGE' && args.zone !== 'RED') {
    return { notified: false, records: [] };
  }

  const subject = `[VacationWeb LIVE-PRICING ${args.zone}] ${args.incident.metric} ${args.incident.provider ?? 'overall'}`;
  const body = formatAlertBody(args.incident, args.zone, args.remediationSummaries);
  const records: NotificationRecord[] = [];
  const nowIso = new Date().toISOString();

  // Console is the only live channel today.
  if (!args.simulationMode && process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
    console.warn(`[live-pricing-ops-ALERT] ${subject}\n${body}`);
  }

  const consoleRec: NotificationRecord = {
    id: newId('ntf'),
    timestamp: nowIso,
    channel: 'console',
    delivered: !args.simulationMode,
    simulated: args.simulationMode,
    incidentId: args.incident.id,
    zone: args.zone,
    subject,
    body,
  };
  appendOpsNotification(consoleRec);
  records.push(consoleRec);

  // Record non-live channel intents when env present (still not delivering).
  for (const ch of getNotificationChannelStatuses()) {
    if (ch.id === 'console' || !ch.available) {
      continue;
    }
    const rec: NotificationRecord = {
      id: newId('ntf'),
      timestamp: nowIso,
      channel: ch.id,
      delivered: false,
      simulated: true,
      incidentId: args.incident.id,
      zone: args.zone,
      subject,
      body: `${body}\n\n[NOT LIVE] Missing live delivery: ${ch.missing.join(', ') || ch.notes}`,
    };
    appendOpsNotification(rec);
    records.push(rec);
  }

  return { notified: true, records };
}
