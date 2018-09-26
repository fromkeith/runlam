
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


function main() {
  try {
    const runfile = load({
        runfile: path.join(__dirname, '../', 'index.js'),
    }, logger, requirer, hasAccess);
    const ARGV = process.argv.slice();

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
