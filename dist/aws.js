"use strict";
/*
    Access to AWS services needed for building and publishing.
    Will attempt to prompt for MFA token to allow publishing

    Option flags
        --aws-profile=default
        --aws-region=us-west-2
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.publish = exports.getAws = void 0;
const prompt = require('prompt');
const fs_1 = require("fs");
const credential_providers_1 = require("@aws-sdk/credential-providers");
const client_sts_1 = require("@aws-sdk/client-sts");
const client_iam_1 = require("@aws-sdk/client-iam");
const client_lambda_1 = require("@aws-sdk/client-lambda");
let credentials;
async function getAws(opts) {
    // delay load
    if (credentials) {
        return credentials;
    }
    credentials = await getCreds(opts);
    return credentials;
}
exports.getAws = getAws;
function promptFor(what) {
    return new Promise((resolve, reject) => {
        prompt.get(what, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result[what]);
        });
    });
}
async function getCreds(opts) {
    // creds already getSessionToken
    if (process.env.AWS_SESSION_TOKEN) {
        return;
    }
    const token = await promptFor('token');
    const region = opts['aws-region'] || 'us-west-2';
    const credentials = (0, credential_providers_1.fromIni)({
        clientConfig: { region },
        profile: opts['aws-profile'] || undefined,
        mfaCodeProvider: async (mfaSerial) => {
            return token;
        },
    });
    const stsClient = new client_sts_1.STSClient({
        credentials,
        region,
    });
    const iamClient = new client_iam_1.IAMClient({
        credentials,
        region,
    });
    const mfaDevices = await iamClient.send(new client_iam_1.ListMFADevicesCommand());
    const creds = await stsClient.send(new client_sts_1.GetSessionTokenCommand({
        SerialNumber: mfaDevices.MFADevices[0].SerialNumber,
        TokenCode: token,
        DurationSeconds: 1200,
    }));
    return (identityProperties) => {
        return Promise.resolve({
            accessKeyId: creds.Credentials.AccessKeyId,
            secretAccessKey: creds.Credentials.SecretAccessKey,
            sessionToken: creds.Credentials.SessionToken,
        });
    };
}
async function publish(opt, zipfile, lambdaName, region) {
    if (typeof zipfile == 'boolean') {
        return;
    }
    const aws = await getAws(opt);
    const buf = await fs_1.promises.readFile(zipfile);
    const client = new client_lambda_1.LambdaClient({ region, credentials });
    await client.send(new client_lambda_1.UpdateFunctionCodeCommand({
        ZipFile: buf,
        FunctionName: lambdaName,
        Publish: !!opt['lambda-do-publish'],
    }));
}
exports.publish = publish;
