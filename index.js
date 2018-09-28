
const {
    run,
    options,
} = require('runjs');

const {
    logger,
} = require('runjs/lib/common');

const aws = require('./aws');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const temp = require('temp');
const win32 = require('./win32');
const {promisify} = require('util');
const {
    loadPackageConfig,
    parseRawFlags,
} = require('./config');

function makeEntryPoint(directory, opt) {
    const entryPath = path.join(directory, opt['entry-override'] || 'index.js');
    return `
const root = require('${entryPath}');
module.exports.handler = (event, context, done) => {
    return root.handler(event, context, done);
};
    `;
}


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
        logger.log('publishing', zipfile, 'to', lambdaName, 'in', region);
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
    run(`tslint -c tslint.json ${fix} **/*.ts`, {cwd: dirs.cwd});
    run(`tsc -p tsconfig.json --outDir ${dirs.dest}`, {cwd: dirs.cwd});
    run(`ncp ./package.json ${dirs.dest}/package.json`, {cwd: dirs.cwd});
    run(`ncp ./package-lock.json ${dirs.dest}/package-lock.json`, {cwd: dirs.cwd});
    run('npm install --only=production', {cwd: dirs.dest});
    // aws-sdk provided on instance
    // so save some zip space
    run('npm remove --save aws-sdk', {cwd: dirs.dest});
    run('npm prune --production', {cwd: dirs.dest});
    // check for any custom dirs that need to be copied. eg. native binaries
    if (opt.copy) {
        if (typeof opt.copy === 'string') {
            opt.copy = [opt.copy];
        }
        for (const dir of opt.copy) {
            if (typeof dir === 'string') {
                run(`ncp ./${dir} ${path.join(dirs.dest, dir)}`, {cwd: dirs.cwd});
            } else {
                run(`ncp ${dir.from} ${path.join(dirs.dest, dir.to)}`, {cwd: dirs.cwd});
            }
        }
    }
    // write a proxy index file
    await promisify(fs.writeFile)(`./${directory}/dist/index.js`, makeEntryPoint(directory, opt));
    // package it
    const filename = `${directory}-${Date.now()}.zip`;
    run(`bestzip ./${filename} *`, {cwd: dirs.dest});
    const localZipFile = path.join(dirs.cwd, filename);
    run(`ncp ${path.join(dirs.dest, filename)} ${localZipFile}`);
    logger.log('Zipfile created: ', localZipFile);
    return localZipFile;
}

async function package(directory, originalFlags) {
    if (!originalFlags || typeof originalFlags === 'string') {
        originalFlags = options(this) || {};
    }

    // apply config. opt will override any read in config
    const config = await loadPackageConfig(directory, originalFlags.stage);
    opt = Object.assign(config, parseRawFlags(originalFlags));
    // switch to linux?
    if (process.platform === 'win32') {
        if (await win32.package(directory, opt, originalFlags)) {
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
        } else {
            zipFileLocation = opt['publish-only'];
        }
    } catch (ex) {
        throw ex;
    } finally {
        // clean build files
        await promisify(rimraf)(`${dirs.dest}`);
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
        return true;
    default:
        return false;
    }
}

// Find subfolder that contain lambda funcs
// and define them as runjs modules.
function findModules() {
    const modules = {};
    const files = fs.readdirSync('.');
    const makeSubDir = (pkg) => {
        return function subdir() {
            package(pkg, options(this));
        };
    };
    for (const f of files) {
        const stat = fs.statSync(f);
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
            fs.accessSync(subRunFilePath);
            const subRunFile = require(subRunFilePath);
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

module.exports = findModules();
