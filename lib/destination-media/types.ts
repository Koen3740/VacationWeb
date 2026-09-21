/**
 * Destination Media Pool v1 (DOC-012 / AN-022 / CHG-023).
 * Minimal types for Discover teaser resolve — not a second media system.
 */
export type DestinationMediaPipelineStatus =
  | 'FINAL_VERIFIED_USABLE'
  | 'RIGHTS_UNCERTAIN'
  | 'RIGHTS_REJECTED'
  | 'QUALITY_REJECTED'
  | string;

export type DestinationMediaPoolAsset = {
  assetId: string;
  destinationId: string;
  placeId?: string;
  storyElement?: string;
  masterPath: string;
  webPath?: string;
  pipelineStatus: DestinationMediaPipelineStatus;
  publishStatus?: string;
  watermarkClass?: string;
};

export type DestinationMediaPool = {
  schemaVersion: number;
  destinationId: string;
  poolType: string;
  assets: DestinationMediaPoolAsset[];
  finalVerifiedUsableCount?: number;
};
