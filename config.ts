import {
    logger,
} from 'runjs/lib/common';

import {promises as fs} from 'fs';
import * as path from 'path';


export interface ILambdaOverride {
    functionName: string;
}
interface IRegionOverride {
    [region: string]: ILambdaOverride;
}
interface ICopyInfo {
    from: string;
    to: string;
    critical?: boolean;
}
interface IBuildInfo {
    copy?: (string | ICopyInfo)[];
    native?: string | boolean;
    arch?: string;
    node?: number;
}
interface IAwsConfig {
    profile?: string;
    region?: string;
}

interface IStages {
    [stage: string]: IConfig;
}
interface ILambda {
    regions?: string[];
    overrides?: IRegionOverride;
    publish?: boolean;
}
export interface IConfig {
    lambda?: ILambda;
    entry?: string;
    stages?: IStages;
    build?: IBuildInfo;
    aws?: IAwsConfig;
}

export interface IConfigFlags {
    ['aws-profile']?: string;
    ['aws-region']?: string; // to get config / creds from
    region?: string[];
    ['lambda-do-publish']?: boolean;
    ['entry-override']?: string;
    copy?: (string | ICopyInfo)[];
    docker?: boolean | string;
    arch?: string;
    ['publish-only']?: boolean;
    ['no-copy']?: boolean;
    nodeVersion?: number;

    // lint fix
    fix?: boolean;
    // dev mode
    dev?: boolean;
    // should we publish
    publish?: boolean;
    // should we release
    release?: boolean;

}


// some flags may come in as json
// unmarshall them here
export function parseRawFlags(opt: IConfig): IConfig {
    const result: any = Object.assign({}, opt);
    for (const key of Object.keys(opt)) {
        if (!key.match(/-json$/)) {
            continue;
        }
        const destKey = key.replace(/-json$/, '');
        if (!result[destKey]) {
            result[destKey] = [];
        } else if (typeof result[destKey] === 'string') {
            result[destKey] = [result[destKey]];
        }
        const parsedItem = JSON.parse(JSON.parse(`"${result[key]}"`));
        if (parsedItem.length) {
            result[destKey] = result[destKey].concat(parsedItem);
        } else {
            result[destKey].push(parsedItem);
        }
        delete result[key];
    }
    return result as IConfig;
}

export function extractConfig(config: IConfig, stage?: string): IConfigFlags {
    // switch to flags
    const flags: IConfigFlags = {};
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
                (flags as any)[`deploy-override-${region}`] = config.lambda.overrides[region];
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
            } else if (config.build.native && config.build.native !== 'wsl') {
                flags.docker = config.build.native;
            }
            if (config.build.arch && flags.docker) {
                flags.arch = config.build.arch;
            }
        }
        if (config.build.node) {
            flags.nodeVersion = config.build.node;
        } else {
            flags.nodeVersion = 16; // default to 16 if not set
            logger.log("No `node` version set, defaulting to 16");
        }
    }
    if (stage) {
        return Object.assign(flags, extractConfig(config.stages[stage]));
    }
    return flags;
}

export async function loadPackageConfig(directory: string, stage: string): Promise<IConfigFlags> {
    const configPath = path.join(directory, 'runlam.json');
    try {
        await fs.access(configPath);
    } catch (ex) {
        // no config
        return {};
    }
    try {
        const configStr = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configStr);
        return extractConfig(config, stage);
    } catch (ex) {
        logger.error('Invalid runlam.json configuration file');
        throw ex;
    }
}

function marshalFlag(name: string, value: string) {
    if (typeof value === 'string') {
        return `--${name}="${value}"`;
    }
    if (typeof value === 'object') {
        return `--${name}-json=${JSON.stringify(JSON.stringify(value))}`;
    }
    return `--${name}`;
}

export function marshalFlags(flags: any) {
    return Object.keys(flags).map((k) => marshalFlag(k, flags[k])).join(' ');
}

