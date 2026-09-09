import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_MATERIAL_OUTPUT_TYPE } from './constants';
import { TradeTrackerSoapError, redactSecrets } from './errors';
import {
  emptyAffiliateSiteFilter,
  emptyCampaignFilter,
  emptyCampaignNewsItemFilter,
  emptyMaterialItemFilter,
} from './soap-filters';
import type { TradeTrackerSoapCredentials } from './types';

export type AffiliateSoapPort = {
  authenticate(credentials: TradeTrackerSoapCredentials): Promise<void>;
  getAffiliateSites(): Promise<unknown>;
  getCampaigns(affiliateSiteID: number): Promise<unknown>;
  getCampaignNewsItems(): Promise<unknown>;
  getMaterialIncentiveOfferItems(affiliateSiteID: number): Promise<unknown>;
  getMaterialIncentiveVoucherItems(affiliateSiteID: number): Promise<unknown>;
};

type SoapClientLike = {
  authenticateAsync: (args: unknown) => Promise<unknown>;
  getAffiliateSitesAsync: (args: unknown) => Promise<unknown>;
  getCampaignsAsync: (args: unknown) => Promise<unknown>;
  getCampaignNewsItemsAsync: (args: unknown) => Promise<unknown>;
  getMaterialIncentiveOfferItemsAsync: (args: unknown) => Promise<unknown>;
  getMaterialIncentiveVoucherItemsAsync: (args: unknown) => Promise<unknown>;
  addHttpHeader?: (name: string, value: string) => void;
  lastResponseHeaders?: Record<string, string | string[] | undefined>;
  lastRequest?: string;
};

function unwrapSoapResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result[0];
  }
  return result;
}

function cookieFromHeaders(headers: Record<string, string | string[] | undefined> | undefined): string | null {
  if (!headers) {
    return null;
  }
  const raw = headers['set-cookie'] ?? headers['Set-Cookie'];
  if (!raw) {
    return null;
  }
  const parts = Array.isArray(raw) ? raw : [raw];
  const cookies = parts
    .map((entry) => String(entry).split(';')[0]?.trim())
    .filter((entry) => entry.length > 0);
  return cookies.length > 0 ? cookies.join('; ') : null;
}

async function callSoap<T>(
  method: string,
  invoke: () => Promise<unknown>,
  knownSecrets: string[] = [],
): Promise<T> {
  try {
    return unwrapSoapResult(await invoke()) as T;
  } catch (error) {
    throw new TradeTrackerSoapError(method, error, knownSecrets);
  }
}

export function createAffiliateSoapPort(client: SoapClientLike): AffiliateSoapPort {
  const persistSessionCookie = () => {
    const cookie = cookieFromHeaders(client.lastResponseHeaders);
    if (cookie && client.addHttpHeader) {
      client.addHttpHeader('Cookie', cookie);
    }
  };

  return {
    async authenticate(credentials) {
      await callSoap(
        'authenticate',
        () =>
          client.authenticateAsync({
            customerID: credentials.customerID,
            passphrase: credentials.passphrase,
            sandbox: credentials.sandbox,
            locale: credentials.locale,
            demo: credentials.demo,
          }),
        [credentials.passphrase],
      );
      persistSessionCookie();
      if (client.lastRequest) {
        client.lastRequest = redactSecrets(client.lastRequest, [credentials.passphrase]);
      }
    },
    getAffiliateSites() {
      return callSoap('getAffiliateSites', () =>
        client.getAffiliateSitesAsync({ options: emptyAffiliateSiteFilter() }),
      );
    },
    getCampaigns(affiliateSiteID) {
      return callSoap('getCampaigns', () =>
        client.getCampaignsAsync({
          affiliateSiteID,
          options: emptyCampaignFilter(),
        }),
      );
    },
    getCampaignNewsItems() {
      return callSoap('getCampaignNewsItems', () =>
        client.getCampaignNewsItemsAsync({ options: emptyCampaignNewsItemFilter() }),
      );
    },
    getMaterialIncentiveOfferItems(affiliateSiteID) {
      return callSoap('getMaterialIncentiveOfferItems', () =>
        client.getMaterialIncentiveOfferItemsAsync({
          affiliateSiteID,
          materialOutputType: TRADETRACKER_MATERIAL_OUTPUT_TYPE,
          options: emptyMaterialItemFilter(),
        }),
      );
    },
    getMaterialIncentiveVoucherItems(affiliateSiteID) {
      return callSoap('getMaterialIncentiveVoucherItems', () =>
        client.getMaterialIncentiveVoucherItemsAsync({
          affiliateSiteID,
          materialOutputType: TRADETRACKER_MATERIAL_OUTPUT_TYPE,
          options: emptyMaterialItemFilter(),
        }),
      );
    },
  };
}

export async function createLiveAffiliateSoapPort(wsdlUrl = TRADETRACKER_AFFILIATE_WSDL_URL): Promise<AffiliateSoapPort> {
  const soap = await import('soap');
  try {
    const client = (await soap.createClientAsync(wsdlUrl, {
      forceSoap12Headers: true,
      disableCache: true,
    })) as unknown as SoapClientLike;
    return createAffiliateSoapPort(client);
  } catch (error) {
    throw new TradeTrackerSoapError('createClient', error);
  }
}
