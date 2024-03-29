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
exports.marshalFlags = exports.loadPackageConfig = exports.extractConfig = exports.parseRawFlags = void 0;
const common_1 = require("runjs/lib/common");
const fs_1 = require("fs");
const path = __importStar(require("path"));
// some flags may come in as json
// unmarshall them here
function parseRawFlags(opt) {
    const result = Object.assign({}, opt);
    for (const key of Object.keys(opt)) {
        if (!key.match(/-json$/)) {
            continue;
        }
        const destKey = key.replace(/-json$/, '');
        if (!result[destKey]) {
            result[destKey] = [];
        }
        else if (typeof result[destKey] === 'string') {
            result[destKey] = [result[destKey]];
        }
        const parsedItem = JSON.parse(JSON.parse(`"${result[key]}"`));
        if (parsedItem.length) {
            result[destKey] = result[destKey].concat(parsedItem);
        }
        else {
            result[destKey].push(parsedItem);
        }
        delete result[key];
    }
    return result;
}
exports.parseRawFlags = parseRawFlags;
function extractConfig(config, stage) {
    // switch to flags
    const flags = {};
    if (config.aws) {
        if (config.aws.profile) {
            flags['aws-profile'] = config.aws.profile;
        }
        if (config.aws.region) {
            flags['aws-region'] = config.aws.region;
        }
    }
    if (config.lambda) {
        if (config.lambda.regions) {
            flags.region = config.lambda.regions;
        }
        if (config.lambda.overrides) {
            for (const region of Object.keys(config.lambda.overrides)) {
                flags[`deploy-override-${region}`] = config.lambda.overrides[region];
            }
        }
        if (config.lambda.publish) {
            flags['lambda-do-publish'] = true;
        }
    }
    if (config.entry) {
        flags['entry-override'] = config.entry;
    }
    if (config.build) {
        if (config.build.copy) {
            flags.copy = config.build.copy.slice();
        }
        if (config.build.native) {
            if (config.build.native === true) {
                flags.docker = true;
            }
            else if (config.build.native && config.build.native !== 'wsl') {
                flags.docker = config.build.native;
            }
            if (config.build.arch && flags.docker) {
                flags.arch = config.build.arch;
            }
        }
        if (config.build.node) {
            flags.nodeVersion = config.build.node;
        }
        else {
            flags.nodeVersion = 16; // default to 16 if not set
            common_1.logger.log("No `node` version set, defaulting to 16");
        }
        if (config.build.lintFix) {
            flags.fix = true;
        }
    }
    if (stage) {
        return Object.assign(flags, extractConfig(config.stages[stage]));
    }
    return flags;
}
exports.extractConfig = extractConfig;
async function loadPackageConfig(directory, stage) {
    const configPath = path.join(directory, 'runlam.json');
    try {
        await fs_1.promises.access(configPath);
    }
    catch (ex) {
        // no config
        return {};
    }
    try {
        const configStr = await fs_1.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(configStr);
        return extractConfig(config, stage);
    }
    catch (ex) {
        common_1.logger.error('Invalid runlam.json configuration file');
        throw ex;
    }
}
exports.loadPackageConfig = loadPackageConfig;
function marshalFlag(name, value) {
    if (typeof value === 'string') {
        return `--${name}="${value}"`;
    }
    if (typeof value === 'object') {
        return `--${name}-json=${JSON.stringify(JSON.stringify(value))}`;
    }
    return `--${name}`;
}
function marshalFlags(flags) {
    return Object.keys(flags).map((k) => marshalFlag(k, flags[k])).join(' ');
}
exports.marshalFlags = marshalFlags;
