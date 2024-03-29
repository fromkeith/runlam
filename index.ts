
import {
    run,
    options,
} from 'runjs';

import {
    logger,
} from 'runjs/lib/common';

import * as aws from './aws';
import * as entry from './entry';
import {promises as fs} from 'fs';
import * as path from 'path';
import {rimraf} from 'rimraf';
const temp = require('temp');
import * as win32 from './win32';
import {promisify} from 'util';
import {exec as execAsync} from 'node:child_process';
const exec = promisify(execAsync);

import {
    loadPackageConfig,
    parseRawFlags,
    type IConfigFlags,
    type ILambdaOverride,
} from './config';

async function publish(opt: IConfigFlags, zipfile: string | boolean, directory: string) {
    if (typeof opt.region === 'string') {
        opt.region = [opt.region];
    }
    for (const region of opt.region) {
        const override: ILambdaOverride | undefined = (opt as any)[`deploy-override-${region}`];
        let lambdaName = directory;
        if (override && override.functionName) {
            lambdaName = override.functionName;
        }
        logger.log('publishing', zipfile, 'to', lambdaName, 'in', region);
        await aws.publish(opt, zipfile, lambdaName, region);
    }
}

function makeTempDir(directory: string): Promise<string> {
    return new Promise((resolve, reject) => {
        temp.mkdir(directory, (err: Error, dirPath: string) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(dirPath);
        });
    });
}


async function build(directory: string, opt: IConfigFlags, dirs: IDirsInfo): Promise<string> {
    let fix = '';
    if (opt.fix) {
        fix = '--fix';
    }
    // verify node version
    if (!opt.nodeVersion) {
        logger.log("No `node` version set, defaulting to 16");
        opt.nodeVersion = 16;
    }
    const {stdout} = await exec("node --version");
    const versionString = stdout.trim();
    if (versionString.indexOf(`v${opt.nodeVersion}`) !== 0) {
        throw `Wrong node version. Aborting build. Expected: v${opt.nodeVersion}`;
    }

    // migrate to eslint
    try {
        await fs.stat(path.join(dirs.cwd, 'eslint.config.js'));
    } catch (ex) {
        run('npm install --save-dev eslint eslint typescript typescript-eslint', {cwd: dirs.cwd});
        await fs.writeFile(path.join(dirs.cwd, 'eslint.config.js'), `import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/*.js', '**/.dist/**'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      quotes: ['error', 'single'],
      '@typescript-eslint/no-unused-vars': [
          "error",
          { "vars": "all", "args": "none", "ignoreRestSiblings": false }
      ]
    },
  }
);

`);
        await fs.writeFile(path.join(dirs.cwd, 'tsconfig.json'), `{
    "compilerOptions": {
        "target": "ES2022",
        "noImplicitAny": true,
        "module": "node16",
        "moduleResolution": "node16",
        "sourceMap": false,
        "outDir": "dist/",
        "baseUrl": ".",
        "esModuleInterop": true,
        "skipLibCheck": true,
        "paths": {
            "*": [
                "node_modules/*",
                "types/*"
            ]
        },
        "lib": [
            "ES2023"
        ]
    },
    "include": [
        "*.ts", "*.d.ts"
    ]
}`);
    }
    run(`npm install --save-dev typescript@latest @types/node@${opt.nodeVersion}`, {cwd: dirs.cwd});
    run(`npx eslint -c eslint.config.js ${fix} **/*.ts`, {cwd: dirs.cwd});
    run(`npx tsc -p tsconfig.json --outDir ${dirs.dest}`, {cwd: dirs.cwd});
    run(`npx ncp ./package.json ${dirs.dest}/package.json`, {cwd: dirs.cwd});
    run(`npx ncp ./package-lock.json ${dirs.dest}/package-lock.json`, {cwd: dirs.cwd});
    run('npm install --only=production', {cwd: dirs.dest});
    // aws-sdk provided on instance
    // so save some zip space
    run('npm remove --save aws-sdk', {cwd: dirs.dest});
    run('npm prune --production', {cwd: dirs.dest});
    // check for any custom dirs that need to be copied. eg. native binaries
    if (opt.copy && !opt['no-copy']) {
        if (typeof opt.copy === 'string') {
            opt.copy = [opt.copy];
        }
        for (const dir of opt.copy) {
            if (typeof dir === 'string') {
                run(`ncp ./${dir} ${path.join(dirs.dest, dir)}`, {cwd: dirs.cwd});
                continue;
            }
            try {
                await run(`ncp ${dir.from} ${path.join(dirs.dest, dir.to)}`, {cwd: dirs.cwd, async: true});
            } catch (ex) {
                if (dir.critical === false) {
                    continue;
                }
                throw ex;
            }
        }
    }
    // write a proxy index file
    await entry.checkIfEntryFileNeeded(directory, dirs.dest, opt);
    if (opt.dev) {
        run(`ncp ${dirs.dest} ${opt.dev}`, {cwd: dirs.cwd});
        return;
    }
    // package it
    const filename = `${directory}-${Date.now()}.zip`;
    run(`bestzip ./${filename} *`, {cwd: dirs.dest});
    const localZipFile = path.join(dirs.cwd, filename);
    run(`ncp ${path.join(dirs.dest, filename)} ${localZipFile}`);
    logger.log('Zipfile created: ', localZipFile);
    return localZipFile;
}

interface IDirsInfo{
    cwd: string;
    dest: string;
}

async function packageUp(directory: string, originalFlags: any) {
    if (!originalFlags || typeof originalFlags === 'string') {
        originalFlags = options(this) || {};
    }

    // apply config. opt will override any read in config
    const config = await loadPackageConfig(directory, originalFlags.stage);
    const opt: IConfigFlags = Object.assign(config, parseRawFlags(originalFlags));
    // switch to linux?
    if (process.platform === 'win32') {
        if (await win32.packageUp(directory, opt, originalFlags)) {
            return;
        }
    }

    const dirs: IDirsInfo = {
        cwd: `./${directory}`,
        dest: await makeTempDir(directory),
    };
    let zipFileLocation: string | boolean;
    try {
        if (!opt['publish-only']) {
            zipFileLocation = await build(directory, opt, dirs);
        } else {
            zipFileLocation = opt['publish-only'];
        }
    } catch (ex) {
        throw ex;
    } finally {
        // clean build files
        await rimraf(dirs.dest);
    }

    if (opt.publish) {
        await publish(opt, zipFileLocation, directory);
    }
}

function isReservedFolder(f: string): boolean {
    switch (f) {
    case 'node_modules':
    case 'bin':
    case 'dist':
    case 'init':
    case 'test':
        return true;
    default:
        return false;
    }
}

// Find subfolder that contain lambda funcs
// and define them as runjs modules.
async function findModules() {
    const modules: any = {};
    const files = await fs.readdir('.');
    const makeSubDir = (pkg: string) => {
        return function subdir() {
            packageUp(pkg, options(this));
        };
    };
    for (const f of files) {
        const stat = await fs.stat(f);
        if (!stat.isDirectory()) {
            continue;
        }
        if (f.indexOf('.') === 0) {
            continue;
        }
        if (isReservedFolder(f)) {
            continue;
        }
        if (modules[f]) {
            continue;
        }
        // import sub runfiles
        try {
            const subRunFilePath = path.join(f, 'runfile.js');
            await fs.access(subRunFilePath);
            const subRunFile = await import(subRunFilePath);
            for (const k of Object.keys(subRunFile)) {
                modules[`${f}:${k}`] = subRunFile[k];
            }
        } catch (ex) {
            // no subrunfile
        }
        modules[f] = makeSubDir(f);
    }
    return modules;
}

export default findModules();
