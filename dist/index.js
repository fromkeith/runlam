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
const runjs_1 = require("runjs");
const common_1 = require("runjs/lib/common");
const aws = __importStar(require("./aws"));
const entry = __importStar(require("./entry"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const rimraf_1 = require("rimraf");
const temp = require('temp');
const win32 = __importStar(require("./win32"));
const util_1 = require("util");
const node_child_process_1 = require("node:child_process");
const exec = (0, util_1.promisify)(node_child_process_1.exec);
const config_1 = require("./config");
async function publish(opt, zipfile, directory) {
    if (typeof opt.region === 'string') {
        opt.region = [opt.region];
    }
    for (const region of opt.region) {
        const override = opt[`deploy-override-${region}`];
        let lambdaName = directory;
        if (override && override.functionName) {
            lambdaName = override.functionName;
        }
        common_1.logger.log('publishing', zipfile, 'to', lambdaName, 'in', region);
        await aws.publish(opt, zipfile, lambdaName, region);
    }
}
function makeTempDir(directory) {
    return new Promise((resolve, reject) => {
        temp.mkdir(directory, (err, dirPath) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(dirPath);
        });
    });
}
async function build(directory, opt, dirs) {
    let fix = '';
    if (opt.fix) {
        fix = '--fix';
    }
    // verify node version
    if (!opt.nodeVersion) {
        common_1.logger.log("No `node` version set, defaulting to 16");
        opt.nodeVersion = 16;
    }
    const { stdout } = await exec("node --version");
    const versionString = stdout.trim();
    if (versionString.indexOf(`v${opt.nodeVersion}`) !== 0) {
        throw `Wrong node version. Aborting build. Expected: v${opt.nodeVersion}`;
    }
    // migrate to eslint
    try {
        await fs_1.promises.stat(path.join(dirs.cwd, '.eslintrc.js'));
    }
    catch (ex) {
        await fs_1.promises.stat(path.join(dirs.cwd, 'tsconfig.json'));
        (0, runjs_1.run)('npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-import@latest eslint-plugin-jsdoc@latest eslint-plugin-prefer-arrow@latest', { cwd: dirs.cwd });
        (0, runjs_1.run)('npx tslint-to-eslint-config', { cwd: dirs.cwd });
    }
    (0, runjs_1.run)(`npx eslint -c .eslintrc.js ${fix} **/*.ts`, { cwd: dirs.cwd });
    (0, runjs_1.run)(`tsc -p tsconfig.json --outDir ${dirs.dest}`, { cwd: dirs.cwd });
    (0, runjs_1.run)(`ncp ./package.json ${dirs.dest}/package.json`, { cwd: dirs.cwd });
    (0, runjs_1.run)(`ncp ./package-lock.json ${dirs.dest}/package-lock.json`, { cwd: dirs.cwd });
    (0, runjs_1.run)('npm install --only=production', { cwd: dirs.dest });
    // aws-sdk provided on instance
    // so save some zip space
    (0, runjs_1.run)('npm remove --save aws-sdk', { cwd: dirs.dest });
    (0, runjs_1.run)('npm prune --production', { cwd: dirs.dest });
    // check for any custom dirs that need to be copied. eg. native binaries
    if (opt.copy && !opt['no-copy']) {
        if (typeof opt.copy === 'string') {
            opt.copy = [opt.copy];
        }
        for (const dir of opt.copy) {
            if (typeof dir === 'string') {
                (0, runjs_1.run)(`ncp ./${dir} ${path.join(dirs.dest, dir)}`, { cwd: dirs.cwd });
                continue;
            }
            try {
                await (0, runjs_1.run)(`ncp ${dir.from} ${path.join(dirs.dest, dir.to)}`, { cwd: dirs.cwd, async: true });
            }
            catch (ex) {
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
        (0, runjs_1.run)(`ncp ${dirs.dest} ${opt.dev}`, { cwd: dirs.cwd });
        return;
    }
    // package it
    const filename = `${directory}-${Date.now()}.zip`;
    (0, runjs_1.run)(`bestzip ./${filename} *`, { cwd: dirs.dest });
    const localZipFile = path.join(dirs.cwd, filename);
    (0, runjs_1.run)(`ncp ${path.join(dirs.dest, filename)} ${localZipFile}`);
    common_1.logger.log('Zipfile created: ', localZipFile);
    return localZipFile;
}
async function packageUp(directory, originalFlags) {
    if (!originalFlags || typeof originalFlags === 'string') {
        originalFlags = (0, runjs_1.options)(this) || {};
    }
    // apply config. opt will override any read in config
    const config = await (0, config_1.loadPackageConfig)(directory, originalFlags.stage);
    const opt = Object.assign(config, (0, config_1.parseRawFlags)(originalFlags));
    // switch to linux?
    if (process.platform === 'win32') {
        if (await win32.packageUp(directory, opt, originalFlags)) {
            return;
        }
    }
    const dirs = {
        cwd: `./${directory}`,
        dest: await makeTempDir(directory),
    };
    let zipFileLocation;
    try {
        if (!opt['publish-only']) {
            zipFileLocation = await build(directory, opt, dirs);
        }
        else {
            zipFileLocation = opt['publish-only'];
        }
    }
    catch (ex) {
        throw ex;
    }
    finally {
        // clean build files
        await (0, rimraf_1.rimraf)(dirs.dest);
    }
    if (opt.publish) {
        await publish(opt, zipFileLocation, directory);
    }
}
function isReservedFolder(f) {
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
    const modules = {};
    const files = await fs_1.promises.readdir('.');
    const makeSubDir = (pkg) => {
        return function subdir() {
            packageUp(pkg, (0, runjs_1.options)(this));
        };
    };
    for (const f of files) {
        const stat = await fs_1.promises.stat(f);
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
            await fs_1.promises.access(subRunFilePath);
            const subRunFile = await import(subRunFilePath);
            for (const k of Object.keys(subRunFile)) {
                modules[`${f}:${k}`] = subRunFile[k];
            }
        }
        catch (ex) {
            // no subrunfile
        }
        modules[f] = makeSubDir(f);
    }
    return modules;
}
exports.default = findModules();
