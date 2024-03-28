"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIfEntryFileNeeded = void 0;
const common_1 = require("runjs/lib/common");
const path = __importStar(require("path"));
const fs_1 = require("fs");
function makeEntryPoint(entryPath) {
    const escaped = entryPath.replace(/\\/g, '/');
    return `
const root = require('./${escaped}');
module.exports.handler = (event, context, done) => {
    return root.handler(event, context, done);
};
    `;
}
async function checkIfEntryFileNeeded(directory, destFolder, opt) {
    const expectedIndex = path.join(destFolder, 'index.js');
    try {
        // check for just an index file existing..
        await fs_1.promises.access(expectedIndex);
        return expectedIndex;
    }
    catch (ex) {
        // ignore
    }
    try {
        // if the entry doesn't exist look in a subdir.. sometimes typescript does that
        const relativePath = path.join(directory, opt['entry-override'] || 'index.js');
        const entryPath = path.join(destFolder, relativePath);
        await fs_1.promises.access(entryPath);
        // create the entry point relay, so that an index.js exists
        await fs_1.promises.writeFile(expectedIndex, makeEntryPoint(relativePath));
        return expectedIndex;
    }
    catch (ex) {
        // ignore
    }
    try {
        // lastly check if an netry override eixsts
        const entryPath = opt['entry-override'];
        if (!entryPath) {
            throw new Error('Unknown entry');
        }
        const filePath = path.join(destFolder, entryPath);
        // if the entry override exists we don't need to create one
        await fs_1.promises.access(filePath);
        return filePath;
    }
    catch (ex) {
        // ignore
    }
    common_1.logger.error('Failed to find or create an entrypoint');
    throw new Error('No entry point');
}
exports.checkIfEntryFileNeeded = checkIfEntryFileNeeded;
