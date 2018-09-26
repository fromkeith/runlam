
const {
    run,
} = require('runjs');

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
    const flags = Object.keys(opt).map(k => `--${k}`).join(' ');
    const env = {};
    if (opt.publish) {
        const aws = await getAws(opt);
        env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
        env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
        env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken;
        env.WSLENV = (env.WSLENV ? (env.WSLENV + ':') : '') + 'AWS_ACCESS_KEY_ID/u:AWS_SECRET_ACCESS_KEY/u:AWS_SESSION_TOKEN/u';
        delete env.AWS_CONFIG_FILE;
    }
    const envFlags = Object.keys(env).map((k) => `-e ${k}=${env[k]}`);
    run(`docker run -v .:/task -it ${envFlags} native-lambda-build bash -c "run package \"${directory}\" ${flags}"`)
    return true;
}

module.exports = {
    package,
};
