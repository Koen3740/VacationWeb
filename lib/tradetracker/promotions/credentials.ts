import fs from 'node:fs';
import path from 'node:path';
import {
  TRADETRACKER_ACCESS_KEY_ENV,
  TRADETRACKER_AFFILIATE_SITE_ID_ENV,
  TRADETRACKER_CUSTOMER_ID_ENV,
  TRADETRACKER_DEFAULT_LOCALE,
  TRADETRACKER_DEMO_ENV,
  TRADETRACKER_LOCALE_ENV,
  TRADETRACKER_SANDBOX_ENV,
} from './constants';
import { TradeTrackerCredentialsError } from './errors';
import type { TradeTrackerSoapCredentials } from './types';

function loadLocalEnvFiles(): void {
  const candidates = ['.env.local', '.env'];

  for (const filename of candidates) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env) || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

type CredentialOptions = {
  /** When false, skip `.env.local` / `.env` file load (tests). Default true. */
  loadFiles?: boolean;
  /** Optional env bag; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
};

function readEnv(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function envFlag(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const value = readEnv(name, env)?.toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function getTradeTrackerSoapCredentials(
  options: CredentialOptions = {},
): TradeTrackerSoapCredentials {
  if (options.loadFiles !== false) {
    loadLocalEnvFiles();
  }

  const env = options.env ?? process.env;
  const customerRaw = readEnv(TRADETRACKER_CUSTOMER_ID_ENV, env);
  const passphrase = readEnv(TRADETRACKER_ACCESS_KEY_ENV, env);

  if (!customerRaw && !passphrase) {
    throw new TradeTrackerCredentialsError(
      `Missing required environment variables: ${TRADETRACKER_CUSTOMER_ID_ENV}, ${TRADETRACKER_ACCESS_KEY_ENV}`,
    );
  }
  if (!customerRaw) {
    throw new TradeTrackerCredentialsError(
      `Missing required environment variable: ${TRADETRACKER_CUSTOMER_ID_ENV}`,
    );
  }
  if (!passphrase) {
    throw new TradeTrackerCredentialsError(
      `Missing required environment variable: ${TRADETRACKER_ACCESS_KEY_ENV}`,
    );
  }

  const customerID = Number(customerRaw);
  if (!Number.isInteger(customerID) || customerID < 0) {
    throw new TradeTrackerCredentialsError(
      `${TRADETRACKER_CUSTOMER_ID_ENV} must be a non-negative integer`,
    );
  }

  return {
    customerID,
    passphrase,
    sandbox: envFlag(TRADETRACKER_SANDBOX_ENV, env),
    locale: readEnv(TRADETRACKER_LOCALE_ENV, env) ?? TRADETRACKER_DEFAULT_LOCALE,
    demo: envFlag(TRADETRACKER_DEMO_ENV, env),
  };
}

export function getOptionalAffiliateSiteIdOverride(
  options: CredentialOptions = {},
): string | null {
  if (options.loadFiles !== false) {
    loadLocalEnvFiles();
  }
  const env = options.env ?? process.env;
  return readEnv(TRADETRACKER_AFFILIATE_SITE_ID_ENV, env) ?? null;
}

export function assertNoSecretLeak(text: string, passphrase: string): void {
  if (passphrase && text.includes(passphrase)) {
    throw new Error('Secret leak: credential value present in output');
  }
}
