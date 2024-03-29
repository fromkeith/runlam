
import {
    logger,
} from 'runjs/lib/common';

import * as path from 'path';
import {promises as fs} from 'fs';
import type {IConfigFlags} from './config';

function makeEntryPoint(entryPath: string) {
    const escaped = entryPath.replace(/\\/g, '/');
    return `
export {handler} from './${escaped}';
    `;
}


export async function checkIfEntryFileNeeded(directory: string, destFolder: string, opt: IConfigFlags) {
    const expectedIndex = path.join(destFolder, 'index.js');
    try {
        // check for just an index file existing..
        await fs.access(expectedIndex);
        return expectedIndex;
    } catch (ex) {
        // ignore
    }
    try {
        // if the entry doesn't exist look in a subdir.. sometimes typescript does that
        const relativePath = path.join(directory, opt['entry-override'] || 'index.js');
        const entryPath = path.join(destFolder, relativePath);
        await fs.access(entryPath);
        // create the entry point relay, so that an index.js exists
        await fs.writeFile(expectedIndex, makeEntryPoint(relativePath));
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
        await fs.access(filePath);
        return filePath;
    } catch (ex) {
        // ignore
    }
    logger.error('Failed to find or create an entrypoint');
    throw new Error('No entry point');
}
