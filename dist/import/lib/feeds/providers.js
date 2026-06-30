"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = void 0;
exports.buildExternalId = buildExternalId;
exports.assertProviderName = assertProviderName;
exports.PROVIDERS = {
    corendon: {
        name: 'Corendon',
        slug: 'corendon',
    },
    prijsvrij: {
        name: 'Prijsvrij',
        slug: 'prijsvrij',
    },
};
function buildExternalId(provider, rawId, variantParts = []) {
    const parts = [exports.PROVIDERS[provider].slug, String(rawId), ...variantParts.map(String).filter(Boolean)];
    return parts.join('-');
}
function assertProviderName(provider, name) {
    const expected = exports.PROVIDERS[provider].name;
    if (name !== expected) {
        throw new Error(`Provider name mismatch: expected "${expected}", received "${name}"`);
    }
    return expected;
}
