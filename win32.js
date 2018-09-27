
const {
    run,
} = require('runjs');

const aws = require('./aws');

// on release force us to run in linux
// TODO: choose between docker & wsl
async function package(directory, opt) {
    // force linux run
    if (!opt.release) {
        return false;
    }
    if (process.platform !== 'win32') {
        return false;
    }
    const flags = Object.keys(opt).map((k) => {
        if (typeof opt[k] === 'string') {
            return `--${k}="${opt[k]}"`;
        }
        return `--${k}`;
    }).join(' ');
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
        const envFlags = Object.keys(env).map((k) => `-e ${k}=${env[k]}`);
        run(`docker run -v ${process.cwd()}:/task -it ${envFlags} ${docker} bash -c "cd task && run package \"${directory}\" ${flags}"`)
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
