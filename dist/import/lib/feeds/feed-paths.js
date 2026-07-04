"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEED_PATHS = void 0;
const node_path_1 = __importDefault(require("node:path"));
const DATA_DIR = node_path_1.default.join(process.cwd(), 'data');
exports.FEED_PATHS = {
    corendon: node_path_1.default.join(DATA_DIR, 'productfeed.xml'),
    prijsvrij: node_path_1.default.join(DATA_DIR, 'prijsvrij.xml'),
    traveldeal: node_path_1.default.join(DATA_DIR, 'traveldeal.xml'),
    offers: node_path_1.default.join(DATA_DIR, 'offers.json'),
    filterOptions: node_path_1.default.join(DATA_DIR, 'filter-options.json'),
    destinationIndex: node_path_1.default.join(DATA_DIR, 'destination-index.json'),
};
