#!/usr/bin/env node

const {
    call,
    describe,
    hasAccess,
    load,
    requirer,
} = require('runjs/lib/script');

const {
    logger,
    RunJSError,
} = require('runjs/lib/common');

const {
    CLIError,
} = require('microcli');

const path = require('path');


async function main() {
  try {
    const runfileProm = load({
        runfile: path.join(__dirname, '../dist/', 'index.js'),
    }, logger, requirer, hasAccess);
    const ARGV = process.argv.slice();
    const runfile = await runfileProm;

    if (ARGV.length > 2) {
      call(runfile, ARGV, logger)
    } else {
      describe(runfile, logger)
    }
  } catch (error) {
    if (error instanceof RunJSError || error instanceof CLIError) {
      logger.error(error.message)
      process.exit(1)
    } else {
      logger.log(error)
      process.exit(1)
    }
  }
}

main();
