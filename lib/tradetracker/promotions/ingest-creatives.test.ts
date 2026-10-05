import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestTradeTrackerCreatives } from './ingest-creatives';
import type { AffiliateSoapPort, MaterialBannerImageItemsOptions } from './soap-client';
import { TradeTrackerSoapError } from './errors';
import type { TradeTrackerSoapCredentials } from './types';

const NL_CREDENTIALS: TradeTrackerSoapCredentials = {
  customerID: 303580,
  passphrase: 'nl-secret-passphrase',
  sandbox: false,
  locale: 'nl_BE',
  demo: false,
};

const BE_CREDENTIALS: TradeTrackerSoapCredentials = {
  customerID: 303580,
  passphrase: 'be-secret-passphrase',
  sandbox: false,
  locale: 'nl_BE',
  demo: false,
};

const NL_CODE =
  '<a href="https://referral.corendon.nl/c?c=38108&m=55&a=512226&r=&u=">' +
  '<img src="https://ti.tradetracker.net/i?c=38108&m=55&a=512226&r=" />' +
  '</a>';

function banner(id: number, campaignId: number, name: string) {
  return {
    ID: id,
    name,
    code: NL_CODE,
    referenceSupported: false,
    materialBannerDimension: { ID: 1, width: 728, height: 90, isCommon: true, isMobile: false },
    campaign: { ID: campaignId, name: 'Corendon NL', URL: 'https://www.corendon.nl/' },
  };
}

function portFor(options: {
  sites: Array<{ ID: number; name: string }>;
  bannersByCampaign: Record<string, unknown[]>;
  failCampaign?: string;
  onAuthenticate?: (credentials: TradeTrackerSoapCredentials) => void;
}): AffiliateSoapPort & { bannerCalls: Array<{ affiliateSiteID: number; options?: MaterialBannerImageItemsOptions }> } {
  const bannerCalls: Array<{ affiliateSiteID: number; options?: MaterialBannerImageItemsOptions }> = [];
  const port: AffiliateSoapPort & {
    bannerCalls: Array<{ affiliateSiteID: number; options?: MaterialBannerImageItemsOptions }>;
  } = {
    bannerCalls,
    async authenticate(credentials) {
      options.onAuthenticate?.(credentials);
    },
    async getAffiliateSites() {
      return { affiliateSites: { affiliateSite: options.sites } };
    },
    async getCampaigns() {
      return { campaigns: { campaign: [] } };
    },
    async getCampaignNewsItems() {
      return { campaignNewsItems: { campaignNewsItem: [] } };
    },
    async getMaterialIncentiveOfferItems() {
      return { materialItems: { materialItem: [] } };
    },
    async getMaterialIncentiveVoucherItems() {
      return { materialItems: { materialItem: [] } };
    },
    async getMaterialBannerImageItems(affiliateSiteID, query) {
      bannerCalls.push({ affiliateSiteID, options: query });
      const campaignId = String(query?.campaignID ?? '');
      if (options.failCampaign && campaignId === options.failCampaign) {
        throw new Error(`SOAP fault passphrase=${NL_CREDENTIALS.passphrase}`);
      }
      return {
        materialItems: {
          materialItem: options.bannersByCampaign[campaignId] ?? [],
        },
      };
    },
  };
  return port;
}

test('NL ingest fetches Corendon 38108 for site 512226 and omits the passphrase', async () => {
  let seenPassphrase = '';
  const port = portFor({
    sites: [
      { ID: 512226, name: 'Vacationweb.nl' },
      { ID: 512055, name: 'MKDigitalMedia' },
    ],
    bannersByCampaign: {
      '38108': [banner(55, 38108, 'Leaderboard'), banner(56, 99999, 'Other campaign')],
    },
    onAuthenticate(credentials) {
      seenPassphrase = credentials.passphrase;
    },
  });

  const snapshot = await ingestTradeTrackerCreatives({
    market: 'nl',
    affiliateSiteId: '512226',
    campaignIds: ['38108'],
    credentials: NL_CREDENTIALS,
    port,
    asOfMs: Date.UTC(2026, 9, 5),
  });

  assert.equal(seenPassphrase, NL_CREDENTIALS.passphrase);
  assert.deepEqual(port.bannerCalls, [{ affiliateSiteID: 512226, options: { campaignID: '38108' } }]);
  assert.equal(snapshot.market, 'nl');
  assert.equal(snapshot.credentialScope, 'nl');
  assert.equal(snapshot.scopedAffiliateSiteId, '512226');
  assert.equal(snapshot.imageDelivery, 'metadata-and-embed-code');
  assert.equal(snapshot.creatives.length, 1);
  assert.equal(snapshot.creatives[0]?.materialItemId, '55');
  assert.equal(snapshot.creatives[0]?.campaignId, '38108');
  assert.equal(snapshot.counts.byCampaignId['38108'], 1);
  assert.equal(JSON.stringify(snapshot).includes(NL_CREDENTIALS.passphrase), false);
});

test('BE session does not query an NL site id', async () => {
  const port = portFor({
    sites: [
      { ID: 511873, name: 'Vacationweb.nl' },
      { ID: 511747, name: 'MKDigitalMedia' },
    ],
    bannersByCampaign: {},
  });

  await assert.rejects(
    () =>
      ingestTradeTrackerCreatives({
        market: 'be',
        affiliateSiteId: '512055',
        campaignIds: ['38103'],
        credentials: BE_CREDENTIALS,
        port,
      }),
    (error: unknown) => {
      assert.ok(error instanceof TradeTrackerSoapError);
      assert.match(error.message, /512055/);
      assert.match(error.message, /be/);
      assert.equal(error.message.includes(BE_CREDENTIALS.passphrase), false);
      return true;
    },
  );
  assert.equal(port.bannerCalls.length, 0);
});

test('a banner method fault is recorded without dropping the snapshot or the passphrase', async () => {
  const port = portFor({
    sites: [{ ID: 511873, name: 'Vacationweb.nl' }],
    bannersByCampaign: {},
    failCampaign: '38103',
  });

  const snapshot = await ingestTradeTrackerCreatives({
    market: 'be',
    affiliateSiteId: '511873',
    campaignIds: ['38103'],
    credentials: BE_CREDENTIALS,
    port,
    asOfMs: Date.UTC(2026, 9, 5),
  });

  assert.equal(snapshot.creatives.length, 0);
  assert.equal(snapshot.credentialScope, 'be');
  assert.equal(snapshot.methodErrors.length, 1);
  assert.match(snapshot.methodErrors[0]?.method ?? '', /38103/);
  assert.equal(snapshot.methodErrors[0]?.message.includes(NL_CREDENTIALS.passphrase), false);
  assert.equal(snapshot.methodErrors[0]?.message.includes(BE_CREDENTIALS.passphrase), false);
  assert.equal(JSON.stringify(snapshot).includes('be-secret-passphrase'), false);
});
