"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDestinationIndex = loadDestinationIndex;
exports.loadDestinationSearchList = loadDestinationSearchList;
const destination_index_json_1 = __importDefault(require("@/data/destination-index.json"));
function loadDestinationIndex() {
    return destination_index_json_1.default;
}
function loadDestinationSearchList() {
    return loadDestinationIndex().searchList;
}
