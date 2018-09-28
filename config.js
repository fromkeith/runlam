const {
    logger,
} = require('runjs/lib/common');

const fs = require('fs');
const path = require('path');
const {promisify} = require('util');


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
    return result;
}

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
            } else if (config.build.native && config.build.native !== 'wsl') {
                flags.docker = config.build.native;
            }
        }
    }
    if (stage) {
        return Object.assign(flags, extractConfig(config.stages[stage]));
    }
    return flags;
}

async function loadPackageConfig(directory, stage) {
    const configPath = path.join(directory, 'runlam.json');
    try {
        await promisify(fs.access)(configPath);
    } catch (ex) {
        // no config
        return {};
    }
    try {
        const configStr = await promisify(fs.readFile)(configPath, 'utf-8');
        const config = JSON.parse(configStr);
        return extractConfig(config, stage);
    } catch (ex) {
        logger.error('Invalid runlam.json configuration file');
        throw ex;
    }
}

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

module.exports = {
    extractConfig,
    loadPackageConfig,
    marshalFlags,
    parseRawFlags,
};
