"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const corendon_1 = require("../lib/feeds/importers/corendon");
const xmlPath = node_path_1.default.join(process.cwd(), 'data', 'productfeed.xml');
const outputPath = node_path_1.default.join(process.cwd(), 'data', 'offers.json');
const xml = node_fs_1.default.readFileSync(xmlPath, 'utf8');
const offers = (0, corendon_1.importCorendonXml)(xml);
node_fs_1.default.writeFileSync(outputPath, JSON.stringify(offers, null, 2));
console.log(`✔ ${offers.length} Corendon-aanbiedingen geïmporteerd`);
console.log('Gebruik npm run import:feeds om alle providers samen te voegen.');
