/*
    Access to AWS services needed for building and publishing.
    Will attempt to prompt for MFA token to allow publishing

    Option flags
        --aws-profile=default
        --aws-region=us-west-2
*/

const prompt = require('prompt');
import {promises as fs} from 'fs';

import {
    fromIni,
    fromTemporaryCredentials,
} from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentityProvider } from "@smithy/types";
import {
    GetSessionTokenCommand,
    GetSessionTokenCommandOutput,
    STSClient,
} from '@aws-sdk/client-sts';
import {
    IAMClient,
    ListMFADevicesCommand,
     ListMFADevicesCommandOutput,
} from '@aws-sdk/client-iam';
import {
    LambdaClient,
    UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda';

import type {IConfigFlags} from './config';


let credentials: AwsCredentialIdentityProvider;

export async function getAws(opts: IConfigFlags) {
    // delay load
    if (credentials) {
        return credentials;
    }
    credentials = await getCreds(opts);
    return credentials;
}

function promptFor(what: string): Promise<string> {
    return new Promise((resolve, reject) => {
        prompt.get(what, (err: Error, result: any) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result[what]);
        });
    });
}


async function getCreds(opts: IConfigFlags): Promise<AwsCredentialIdentityProvider> {
    // creds already getSessionToken
    if (process.env.AWS_SESSION_TOKEN) {
        return;
    }
    const token = await promptFor('token');
    const region = opts['aws-region'] || 'us-west-2';
    const credentials = fromIni({
        clientConfig: {region},
        profile: opts['aws-profile'] || undefined,
        mfaCodeProvider: async (mfaSerial: string) => {
            return token;
        },
    });
    const stsClient = new STSClient({
        credentials,
        region,
    });
    const iamClient = new IAMClient({
        credentials,
        region,
    })
    const mfaDevices = await iamClient.send(new ListMFADevicesCommand());

    const creds = await stsClient.send(new GetSessionTokenCommand({
        SerialNumber: mfaDevices.MFADevices[0].SerialNumber,
        TokenCode: token,
        DurationSeconds: 1200,
    }));

    return (identityProperties?: Record<string, any>) => {
        return Promise.resolve({
            accessKeyId: creds.Credentials.AccessKeyId,
            secretAccessKey: creds.Credentials.SecretAccessKey,
            sessionToken: creds.Credentials.SessionToken,
        });
    };
}

export async function publish(opt: IConfigFlags, zipfile: string | boolean, lambdaName: string, region: string) {
    if (typeof zipfile == 'boolean') {
        return;
    }
    const aws = await getAws(opt);
    const buf = await fs.readFile(zipfile);
    const client = new LambdaClient({region, credentials});
    await client.send(new UpdateFunctionCodeCommand({
        ZipFile: buf,
        FunctionName: lambdaName,
        Publish: !!opt['lambda-do-publish'],
    }));
}
