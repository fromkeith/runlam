"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageUp = void 0;
const runjs_1 = require("runjs");
const config_1 = require("./config");
const aws_1 = require("./aws");
const client_lambda_1 = require("@aws-sdk/client-lambda");
// on release force us to run in linux
// TODO: choose between docker & wsl
async function packageUp(directory, opt, originalFlags) {
    // force linux run
    if (!opt.release) {
        return false;
    }
    if (process.platform !== 'win32') {
        return false;
    }
    const flags = (0, config_1.marshalFlags)(originalFlags);
    const env = {};
    if (opt.publish) {
        const credentials = await (0, aws_1.getAws)(opt);
        const lc = new client_lambda_1.LambdaClient({ credentials });
        const creds = await credentials();
        env.AWS_ACCESS_KEY_ID = creds.accessKeyId;
        env.AWS_SECRET_ACCESS_KEY = creds.secretAccessKey;
        env.AWS_SESSION_TOKEN = creds.sessionToken;
        // needed for WSL to forward the AWS keys.
        env.WSLENV = (env.WSLENV ? (env.WSLENV + ':') : '') + 'AWS_ACCESS_KEY_ID/u:AWS_SECRET_ACCESS_KEY/u:AWS_SESSION_TOKEN/u';
        delete env.AWS_CONFIG_FILE;
    }
    if (opt.docker) {
        const docker = typeof opt.docker === 'string' ? opt.docker : 'fromkeith/runlam';
        env.IS_DOCKER = '1';
        const envFlags = Object.keys(env).map((k) => `-e ${k}=${env[k]}`).join(' ');
        let platformArch = '';
        if (opt.arch) {
            platformArch = `--platform ${opt.arch}`;
        }
        (0, runjs_1.run)(`docker run -v ${process.cwd()}:/task -it ${envFlags} ${platformArch} ${docker} bash -c ". /root/.bashrc && cd task && runlam \\"${directory}\\" ${flags}"`);
    }
    else {
        (0, runjs_1.run)(`bash -l -c "nvm use ${opt.nodeVersion} && npm update -g && runlam \\"${directory}\\" ${flags}"`, {
            env,
        });
    }
    return true;
}
exports.packageUp = packageUp;
