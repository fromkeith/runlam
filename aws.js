/*
    Access to AWS services needed for building and publishing.
    Will attempt to prompt for MFA token to allow publishing

    Option flags
        --aws-profile=default
        --aws-region=us-west-2
*/

const prompt = require('prompt');

let awsInstance;

async function getAws(opts) {
    // delay load
    if (awsInstance) {
        return awsInstance;
    }
    awsInstance = require('aws-sdk');
    await getCreds(awsInstance, opts);
    return awsInstance;
}

function promptFor(what) {
    return new Promise((resolve, reject) => {
        prompt.get(what, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result);
        });
    });
}

function getMfaDevices(iam) {
    return new Promise((resolve, reject) => {
        iam.listMFADevices((err, data) => {
            if (err) {
                reject(new Error(err));
                return;
            }
            resolve(data.MFADevices);
        });
    });
}

function getStsToken(sts, deviceList, tokenResp) {
    return new Promise((resolve, reject) => {
        sts.getSessionToken({
            DurationSeconds: 1800,
            SerialNumber: deviceList[0].SerialNumber,
            TokenCode: tokenResp.token,
        }, (err, data) => {
            if (err) {
                reject(new Error(err));
                return;
            }
            resolve(data);
        });
    });
}

async function getCreds(aws, opts) {
    if (opts['aws-profile']) {
        const credentials = new aws.SharedIniFileCredentials({profile: opts['aws-profile']});
        aws.config.credentials = credentials;
    }
    const region = opts['aws-region'] || 'us-west-2';
    const sts = new aws.STS({region});
    const iam = new aws.IAM({region});
    const deviceList = await getMfaDevices(iam);
    if (deviceList && deviceList.length > 0) {
        const tokenResp = await promptFor('token');
        const authData = await getStsToken(sts, deviceList, tokenResp);
        aws.config.credentials = sts.credentialsFrom(authData);
    }
}

async function publish(opt, zipfile, lambdaName, region) {
    console.log('publishing', zipfile, 'to', lambdaName);
    const aws = await getAws(opt);
    const buf = await new Promise((resolve, reject) => {
        fs.readFile(zipfile, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result);
        });
    });
    await new Promise((resolve, reject) => {
        const lambda = new aws.Lambda({region});
        lambda.updateFunctionCode({
            ZipFile: buf,
            FunctionName: lambdaName,
            Publish: !!opt['lambda-do-publish'],
        }, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}


module.exports = {
    getAws,
    publish,
};
