
const {
    logger,
} = require('runjs/lib/common');

const path = require('path');
const {promisify} = require('util');
const fs = require('fs');

function makeEntryPoint(directory, entryPath) {
    return `
const root = require('${entryPath}');
module.exports.handler = (event, context, done) => {
    return root.handler(event, context, done);
};
    `;
}


async function checkIfEntryFileNeeded(directory, destFolder, opt) {
    const expectedIndex = path.join(destFolder, 'index.js');
    try {
        // check for just an index file existing..
        await promisify(fs.access)(expectedIndex);
        return expectedIndex;
    } catch (ex) {
        // ignore
    }
    try {
        // if the entry doesn't exist look in a subdir.. sometimes typescript does that
        const relativePath = path.join(directory, opt['entry-override'] || 'index.js');
        const entryPath = path.join(destFolder, relativePath);
        await promisify(fs.access)(entryPath);
        // create the entry point relay, so that an index.js exists
        await promisify(fs.writeFile)(expectedIndex, makeEntryPoint(directory, relativePath));
        return expectedIndex;
    } catch (ex) {
        // ignore
    }
    try {
        // lastly check if an netry override eixsts
        const entryPath = opt['entry-override'];
        if (!entryPath) {
            throw new Error('Unknown entry');
        }
        const filePath = path.join(destFolder, entryPath);
        // if the entry override exists we don't need to create one
        await promisify(fs.access)(filePath);
        return filePath;
    } catch (ex) {
        // ignore
    }
    logger.error('Failed to find or create an entrypoint');
    throw new Error('No entry point');
}

module.exports = {
    checkIfEntryFileNeeded,
};
