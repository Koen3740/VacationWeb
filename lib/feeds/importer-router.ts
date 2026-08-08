import { importCorendonXml } from './importers/corendon';
import { importPrijsvrijXml } from './importers/prijsvrij';
import { importSunwebXml } from './importers/sunweb';
import { StoredOffer } from './types/stored-offer';

export type ImporterProfile = 'corendon' | 'prijsvrij' | 'sunweb';

type XmlImporter = (xml: string) => StoredOffer[];

const IMPORTERS: Record<ImporterProfile, XmlImporter> = {
  corendon: importCorendonXml,
  prijsvrij: importPrijsvrijXml,
  sunweb: importSunwebXml,
};

export function isKnownImporterProfile(profile: string): profile is ImporterProfile {
  return Object.prototype.hasOwnProperty.call(IMPORTERS, profile);
}

export function listImporterProfiles(): ImporterProfile[] {
  return Object.keys(IMPORTERS) as ImporterProfile[];
}

/** Routes a feed profile to the existing XML importer. Importers themselves are unchanged. */
export function importXmlByProfile(profile: string, xml: string): StoredOffer[] {
  if (!isKnownImporterProfile(profile)) {
    throw new Error(
      `No importer registered for profile "${profile}". Known profiles: ${listImporterProfiles().join(', ')}`,
    );
  }

  return IMPORTERS[profile](xml);
}
