

async function extractConfig(config, stage) {
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
                flags[`deploy-override-${region}`] = config.lambdaName[region].functionName;
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
            flags.copy = config.copy.slice();
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
        return Object.assign(flags, await extractConfig(config.stages[stage]));
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

module.exports = {
    loadPackageConfig,
};
