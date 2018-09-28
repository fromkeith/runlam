
const {
    run,
} = require('runjs');

const {
    marshalFlags,
} = require('./config');

const aws = require('./aws');


// on release force us to run in linux
// TODO: choose between docker & wsl
async function package(directory, opt, originalFlags) {
    // force linux run
    if (!opt.release) {
        return false;
    }
    if (process.platform !== 'win32') {
        return false;
    }
    const flags = marshalFlags(originalFlags);
    const env = {};
    if (opt.publish) {
        const awsInstance = await aws.getAws(opt);
        env.AWS_ACCESS_KEY_ID = awsInstance.config.credentials.accessKeyId;
        env.AWS_SECRET_ACCESS_KEY = awsInstance.config.credentials.secretAccessKey;
        env.AWS_SESSION_TOKEN = awsInstance.config.credentials.sessionToken;
        // needed for WSL to forward the AWS keys.
        env.WSLENV = (env.WSLENV ? (env.WSLENV + ':') : '') + 'AWS_ACCESS_KEY_ID/u:AWS_SECRET_ACCESS_KEY/u:AWS_SESSION_TOKEN/u';
        delete env.AWS_CONFIG_FILE;
    }
    if (opt.docker) {
        const docker = typeof opt.docker === 'string' ? opt.docker : 'native-lambda-build';
        env.IS_DOCKER = '1';
        const envFlags = Object.keys(env).map((k) => `-e ${k}=${env[k]}`).join(' ');
        run(`docker run -v ${process.cwd()}:/task -it ${envFlags} ${docker} bash -c "cd task && runlam \"${directory}\" ${flags}"`);
    } else {
        run(`bash -c "run package \"${directory}\" ${flags}"`, {
            env,
        });
    }
    return true;
}

module.exports = {
    package,
};
