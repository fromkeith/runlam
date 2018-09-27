
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
const win32 = require('./win32');
const {promisify} = require('util');
const {loadPackageConfig} = require('./config');

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
        console.log('publishing', zipfile, 'to', lambdaName);
        await aws.publish(opt, zipfile, lambdaName, region);
    }
}



async function package(directory, opt) {
    if (!opt || typeof opt === 'string') {
        opt = options(this) || {};
    }

    const workDir = {
        cwd: `./${directory}`,
    };
    // clean build
    await promisify(rimraf)(`${workDir.cwd}/dist`);

    // apply config. opt will override any read in config
    const config = await loadPackageConfig(directory);
    opt = Object.assign(config, opt);
    // switch to linux?
    if (process.platform === 'win32') {
        if (await win32.package(directory, opt)) {
            return;
        }
    }

    let fix = '';
    if (opt.fix) {
        fix = '--fix';
    }
    run(`tslint -c tslint.json ${fix} **/*.ts`, workDir);
    run('tsc -p tsconfig.json', workDir);
    run('ncp ./package.json ./dist/package.json', workDir);
    run('ncp ./package-lock.json ./dist/package-lock.json', workDir);
    run('npm install --only=production', {
        cwd: `${workDir.cwd}/dist`,
    });
    // aws-sdk provided on instance
    // so save some zip space
    run('npm remove --save aws-sdk', {
        cwd: `${workDir.cwd}/dist`,
    });
    if (process.env.WEIRD_DOCKER_ERR) {
        // prune throws an error.
        // Unknown system error -116: Unknown system error -116, open '/task/myfunc/dist/node_modules/.bin/tsserver'
        await promisify(setTimeout)(1000);
    }
    run('npm prune --production', {
        cwd: `${workDir.cwd}/dist`,
    });
    // check for any custom dirs that need to be copied. eg. native binaries
    if (opt.copy) {
        if (typeof opt.copy === 'string') {
            opt.copy = [opt.copy];
        }
        for (const dir of opt.copy) {
            run(`ncp ./${dir} ./dist/${dir}`, workDir);
        }
    }
    // write a proxy index file
    await promisify(fs.writeFile)(`./${directory}/dist/index.js`, makeEntryPoint(directory, opt));
    const filename = `${directory}-${Date.now()}.zip`;
    run(`bestzip ../${filename} *`, {
        cwd: `${workDir.cwd}/dist`,
    });
    if (opt.publish) {
        await publish(opt, path.join(workDir.cwd, filename), directory);
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
