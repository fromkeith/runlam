
import {
    run,
} from 'runjs';

import {
    marshalFlags,
    type IConfigFlags,
} from './config';

import {getAws} from './aws';

import {
            LambdaClient,
            UpdateFunctionCodeCommand,
        } from '@aws-sdk/client-lambda';

// on release force us to run in linux
// TODO: choose between docker & wsl
export async function packageUp(directory: string, opt: IConfigFlags, originalFlags: IConfigFlags): Promise<boolean> {
    // force linux run
    if (!opt.release) {
        return false;
    }
    if (process.platform !== 'win32') {
        return false;
    }
    const flags = marshalFlags(originalFlags);
    const env: any = {};
    if (opt.publish) {
        const credentials = await getAws(opt);
        const lc = new LambdaClient({credentials});


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
        run(`docker run -v ${process.cwd()}:/task -it ${envFlags} ${platformArch} ${docker} bash -c "cd task && npm install -g https://github.com/fromkeith/runlam.git && runlam \\"${directory}\\" ${flags}"`);
    } else {
        run(`bash -l -c "nvm use ${opt.nodeVersion} && npm install -g https://github.com/fromkeith/runlam.git && runlam \\"${directory}\\" ${flags}"`, {
            env,
        });
    }
    return true;
}

