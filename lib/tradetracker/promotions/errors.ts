const SECRET_PATTERNS: RegExp[] = [
  /passphrase\s*[:=]\s*\S+/gi,
];

export function redactSecrets(text: string, knownSecrets: string[] = []): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, 'passphrase=[redacted]');
  }
  for (const secret of knownSecrets) {
    if (secret && out.includes(secret)) {
      out = out.split(secret).join('[redacted]');
    }
  }
  return out;
}

export function publicErrorMessage(
  error: unknown,
  fallback = 'TradeTracker Webservice error',
  knownSecrets: string[] = [],
): string {
  if (error instanceof Error && error.message.trim()) {
    return redactSecrets(error.message, knownSecrets);
  }
  if (typeof error === 'string' && error.trim()) {
    return redactSecrets(error, knownSecrets);
  }
  return fallback;
}

export class TradeTrackerCredentialsError extends Error {
  constructor(message: string) {
    super(redactSecrets(message));
    this.name = 'TradeTrackerCredentialsError';
  }
}

export class TradeTrackerSoapError extends Error {
  readonly method: string;

  constructor(method: string, error: unknown, knownSecrets: string[] = []) {
    super(`${method}: ${publicErrorMessage(error, 'TradeTracker Webservice error', knownSecrets)}`);
    this.name = 'TradeTrackerSoapError';
    this.method = method;
  }
}
