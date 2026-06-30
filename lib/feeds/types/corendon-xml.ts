export interface CorendonXmlProperty {
  name: string;
  value: string | number | boolean;
}

export interface CorendonXmlPrice {
  '#text'?: string | number;
  currency?: string;
}

export interface CorendonXmlProduct {
  ID: string | number;
  campaignID?: string | number;
  name: string;
  price?: CorendonXmlPrice | string | number;
  URL: string;
  images?: {
    image?: string | string[];
  };
  description?: string;
  categories?: string | { category?: string | string[] };
  variations?: string | Record<string, unknown>;
  properties?: {
    property?: CorendonXmlProperty | CorendonXmlProperty[];
  };
}

export interface CorendonXmlFeed {
  products: {
    product: CorendonXmlProduct | CorendonXmlProduct[];
  };
}
