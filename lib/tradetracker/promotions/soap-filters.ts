/** WSDL sequence fields; null serializes as xsi:nil via the SOAP client. */
export function emptyAffiliateSiteFilter(): Record<string, null> {
  return {
    ID: null,
    query: null,
    affiliateSiteCategoryID: null,
    affiliateSiteTypeID: null,
    affiliateSiteStatus: null,
    limit: null,
    offset: null,
    sort: null,
    sortDirection: null,
    excludeInfo: null,
  };
}

export function emptyCampaignFilter(): Record<string, null> {
  return {
    ID: null,
    query: null,
    campaignCategoryID: null,
    assignmentStatus: null,
    policySearchEngineMarketingStatus: null,
    policyEmailMarketingStatus: null,
    policyCashbackStatus: null,
    policyDiscountCodeStatus: null,
    limit: null,
    offset: null,
    sort: null,
    sortDirection: null,
    excludeInfo: null,
  };
}

export function emptyCampaignNewsItemFilter(): Record<string, null> {
  return {
    ID: null,
    query: null,
    campaignCategoryID: null,
    campaignNewsType: null,
    publishDateFrom: null,
    publishDateTo: null,
    limit: null,
    offset: null,
  };
}

export function emptyMaterialItemFilter(): Record<string, null> {
  return {
    ID: null,
    query: null,
    campaignID: null,
    campaignCategoryID: null,
    includeUnsubscribedCampaigns: null,
    materialBannerDimensionID: null,
    reference: null,
    limit: null,
    offset: null,
    sort: null,
    sortDirection: null,
  };
}
