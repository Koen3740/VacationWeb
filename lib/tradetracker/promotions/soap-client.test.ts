import assert from 'node:assert/strict';
import test from 'node:test';
import { TRADETRACKER_MATERIAL_OUTPUT_TYPE } from './constants';
import { TradeTrackerSoapError } from './errors';
import { createAffiliateSoapPort } from './soap-client';
import type { TradeTrackerSoapCredentials } from './types';

const CREDENTIALS: TradeTrackerSoapCredentials = {
  customerID: 303580,
  passphrase: 'super-secret-passphrase',
  sandbox: false,
  locale: 'nl_BE',
  demo: false,
};

test('getMaterialBannerImageItems sends html output and a campaign filter', async () => {
  const calls: unknown[] = [];
  const client = {
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
    async getMaterialBannerImageItemsAsync(args: unknown) {
      calls.push(args);
      return [{ materialItems: { materialItem: [] } }];
    },
  };

  const port = createAffiliateSoapPort(client);
  await port.authenticate(CREDENTIALS);
  await port.getMaterialBannerImageItems(512226, { campaignID: '38108' });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    affiliateSiteID: 512226,
    materialOutputType: TRADETRACKER_MATERIAL_OUTPUT_TYPE,
    options: {
      ID: null,
      query: null,
      campaignID: 38108,
      campaignCategoryID: null,
      includeUnsubscribedCampaigns: null,
      materialBannerDimensionID: null,
      reference: null,
      limit: null,
      offset: null,
      sort: null,
      sortDirection: null,
    },
  });
});

test('getMaterialBannerImageItems rejects a non-numeric campaign id before the SOAP call', async () => {
  let called = false;
  const client = {
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
    async getMaterialBannerImageItemsAsync() {
      called = true;
      return [{}];
    },
  };

  const port = createAffiliateSoapPort(client);
  await assert.rejects(
    async () => {
      await port.getMaterialBannerImageItems(511873, { campaignID: 'corendon' });
    },
    (error: unknown) => {
      assert.ok(error instanceof TradeTrackerSoapError);
      assert.match(error.message, /campaignID/);
      return true;
    },
  );
  assert.equal(called, false);
});
