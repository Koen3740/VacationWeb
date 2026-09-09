import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestTradeTrackerPromotions, snapshotCounts } from './ingest';
import { createAffiliateSoapPort, type AffiliateSoapPort } from './soap-client';
import { TradeTrackerSoapError } from './errors';
import type { TradeTrackerSoapCredentials } from './types';

const CREDENTIALS: TradeTrackerSoapCredentials = {
  customerID: 1,
  passphrase: 'super-secret-passphrase',
  sandbox: false,
  locale: 'nl_BE',
  demo: false,
};

function fakePort(overrides: Partial<AffiliateSoapPort> = {}): AffiliateSoapPort {
  return {
    async authenticate() {},
    async getAffiliateSites() {
      return {
        affiliateSites: {
          affiliateSite: [{ ID: 512226, name: 'VacationWeb', URL: 'https://vacationweb.example' }],
        },
      };
    },
    async getCampaigns() {
      return {
        campaigns: {
          campaign: [
            { ID: 1488, name: 'Corendon', URL: 'https://www.corendon.be/' },
            { ID: 1393, name: 'Sunweb', URL: 'https://www.sunweb.be/' },
          ],
        },
      };
    },
    async getCampaignNewsItems() {
      return {
        campaignNewsItems: {
          campaignNewsItem: {
            ID: 5,
            campaignNewsType: 'campaign_update_general',
            title: 'Update',
            content: 'Source news',
            publishDate: '2026-09-01',
            expirationDate: '2026-09-30',
            campaign: { ID: 1488, name: 'Corendon' },
          },
        },
      };
    },
    async getMaterialIncentiveOfferItems() {
      return {
        materialItems: {
          materialItem: {
            ID: 21,
            name: 'Offer material',
            validFromDate: '2026-09-01',
            campaign: { ID: 1488, name: 'Corendon' },
          },
        },
      };
    },
    async getMaterialIncentiveVoucherItems() {
      return {
        materialItems: {
          materialItem: {
            ID: 22,
            name: 'Voucher material',
            voucherCode: 'KEEP-SOURCE',
            validFromDate: '2026-09-01',
            campaign: { ID: 1488, name: 'Corendon' },
          },
        },
      };
    },
    ...overrides,
  };
}

test('successful ingest normalizes campaigns, news, incentives and vouchers', async () => {
  const snapshot = await ingestTradeTrackerPromotions({
    port: fakePort(),
    credentials: CREDENTIALS,
    asOfMs: Date.UTC(2026, 8, 7),
  });
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes(CREDENTIALS.passphrase), false);
  assert.equal(snapshot.campaigns.length, 2);
  assert.equal(snapshot.newsItems[0]?.newsType, 'campaign_update_general');
  assert.equal(snapshot.incentiveOffers[0]?.kind, 'incentive_offer');
  assert.equal(snapshot.vouchers[0]?.kind, 'voucher');
  assert.deepEqual(snapshotCounts(snapshot).campaigns, 2);
});

test('API error on authenticate fails ingest without leaking passphrase', async () => {
  await assert.rejects(
    () =>
      ingestTradeTrackerPromotions({
        port: fakePort({
          authenticate: async () => {
            throw new Error(`auth failed passphrase=${CREDENTIALS.passphrase}`);
          },
        }),
        credentials: CREDENTIALS,
      }),
    (error: unknown) => {
      assert.ok(error instanceof TradeTrackerSoapError);
      assert.equal(error.message.includes(CREDENTIALS.passphrase), false);
      assert.match(error.message, /authenticate/);
      return true;
    },
  );
});

test('malformed getAffiliateSites response is an API error', async () => {
  await assert.rejects(
    () =>
      ingestTradeTrackerPromotions({
        port: fakePort({
          getAffiliateSites: async () => null,
        }),
        credentials: CREDENTIALS,
      }),
    /Malformed response/,
  );
});

test('non-fatal method errors are recorded; campaigns from other methods remain', async () => {
  const snapshot = await ingestTradeTrackerPromotions({
    port: fakePort({
      getCampaignNewsItems: async () => {
        throw new Error('SOAP-ENV:Server');
      },
    }),
    credentials: CREDENTIALS,
  });
  assert.equal(snapshot.campaigns.length, 2);
  assert.equal(snapshot.newsItems.length, 0);
  assert.equal(snapshot.methodErrors.some((item) => item.method === 'getCampaignNewsItems'), true);
});

test('soap port persists session cookie from authenticate headers', async () => {
  const headers: Record<string, string> = {};
  const client = {
    lastResponseHeaders: { 'set-cookie': ['SID=abc; Path=/'] },
    lastRequest: `passphrase>${CREDENTIALS.passphrase}</passphrase>`,
    addHttpHeader(name: string, value: string) {
      headers[name] = value;
    },
    async authenticateAsync() {
      return [{}];
    },
    async getAffiliateSitesAsync() {
      return [{}];
    },
    async getCampaignsAsync() {
      return [{}];
    },
    async getCampaignNewsItemsAsync() {
      return [{}];
    },
    async getMaterialIncentiveOfferItemsAsync() {
      return [{}];
    },
    async getMaterialIncentiveVoucherItemsAsync() {
      return [{}];
    },
  };
  const port = createAffiliateSoapPort(client);
  await port.authenticate(CREDENTIALS);
  assert.equal(headers.Cookie, 'SID=abc');
  assert.equal(client.lastRequest.includes(CREDENTIALS.passphrase), false);
});
