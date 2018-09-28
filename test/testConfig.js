const expect = require('chai').expect;
const {
    extractConfig,
    marshalFlags,
    parseRawFlags,
} = require('../config');
const microcli = require('microcli');
const stringArgv = require('string-argv');

describe('config parsing', function () {

    describe('flag parsing', function () {
        it('should do nothing!', function () {
            const input = {
                copy: 'dir',
            };
            const result = parseRawFlags(input);
            expect(result).to.deep.equal(input);
        });
        it('should create copy and parse json', function () {
            const input = {
                'copy-json': '{\\"from\\":\\"asd\\",\\"to\\":\\"bob\\"}',
            };
            const result = parseRawFlags(input);
            expect(result).to.deep.equal({
                copy: [{from: 'asd', to: 'bob'}],
            });
        });
        it('should create copy and parse json, with multiple properties', function () {
            const input = {
                'copy-json': '[{\\"from\\":\\"asd\\",\\"to\\":\\"bob\\"},{\\"from\\":\\"2\\",\\"to\\":\\"3\\"}]',
            };
            const result = parseRawFlags(input);
            expect(result).to.deep.equal({
                copy: [
                    {from: 'asd', to: 'bob'},
                    {from: '2', to: '3'}
                ],
            });
        });
        it('should create copy and parse json, with a regular copy existing', function () {
            const input = {
                'copy-json': ['{\\"from\\":\\"asd\\",\\"to\\":\\"bob\\"}'],
                copy: 'hello'
            };
            const result = parseRawFlags(input);
            expect(result).to.deep.equal({
                copy: [
                    'hello',
                    {from: 'asd', to: 'bob'},
                ],
            });
        });
        it('should create copy and parse json, multi party!', function () {
            const input = {
                'copy-json': '[{\\"from\\":\\"asd\\",\\"to\\":\\"bob\\"},{\\"from\\":\\"2\\",\\"to\\":\\"3\\"}]',
                copy: ['hello', 'world']
            };
            const result = parseRawFlags(input);
            expect(result).to.deep.equal({
                copy: [
                    'hello',
                    'world',
                    {from: 'asd', to: 'bob'},
                    {from: '2', to: '3'}
                ],
            });
        });
    });
    describe('extract config', function () {
        it('should set aws flags', function () {
            const flags = extractConfig({
                aws: {
                    profile: 'hello',
                    region: 'us-east-1',
                },
            });
            expect(flags).to.deep.equal({
                'aws-profile': 'hello',
                'aws-region': 'us-east-1',
            });
        });
        it('should set lambda regions', function () {
            const flags = extractConfig({
                lambda: {
                    regions: ['us-east-1', 'ap-southeast-1'],
                },
            });
            expect(flags).to.deep.equal({
                region: ['us-east-1', 'ap-southeast-1'],
            });
        });
        it('should set lambda overrides', function () {
            const flags = extractConfig({
                lambda: {
                    overrides: {
                        'us-east-1': {
                            functionName: 'bobby',
                        },
                        'ap-southeast-1': {
                            functionName: 'greg',
                        },
                    },
                },
            });
            expect(flags).to.deep.equal({
                'deploy-override-us-east-1': 'bobby',
                'deploy-override-ap-southeast-1': 'greg',
            });
        });
        it('should set lambda to publish', function () {
            const flags = extractConfig({
                lambda: {
                    publish: true,
                },
            });
            expect(flags).to.deep.equal({
                'lambda-do-publish': true,
            });
        });
        it('should override entrypoint', function () {
            const flags = extractConfig({
                entry: 'valhala',
            });
            expect(flags).to.deep.equal({
                'entry-override': 'valhala',
            });
        });
        describe('build-section', function () {
            it('should copy the copy section', function () {
                const flags = extractConfig({
                    build: {
                        copy: ['heidi', 'theordore'],
                    },
                });
                expect(flags).to.deep.equal({
                    copy: ['heidi', 'theordore'],
                });
            });
            it('should set to use a docker image', function () {
                const flags = extractConfig({
                    build: {
                        native: true,
                    },
                });
                expect(flags).to.deep.equal({
                    docker: true,
                });
            });
            it('should set to use a custom docker image', function () {
                const flags = extractConfig({
                    build: {
                        native: 'bobs-burgers',
                    },
                });
                expect(flags).to.deep.equal({
                    docker: 'bobs-burgers',
                });
            });
        });
    });
    describe('flags to commandline args', function () {
        it('does basic string commands', function () {
            const command = marshalFlags({
                'aws-region': 'eu-west-1',
            });
            expect(command).to.be.equal('--aws-region="eu-west-1"');
        });
        it('encodes a single item array', function () {
            const command = marshalFlags({
                'aws-region': ['eu-west-1'],
            });
            expect(command).to.be.equal('--aws-region-json="[\\"eu-west-1\\"]"');
        });
        it('encodes a multi-item array', function () {
            const command = marshalFlags({
                'aws-region': ['eu-west-1', 'us-east-2'],
            });
            expect(command).to.be.equal('--aws-region-json="[\\"eu-west-1\\",\\"us-east-2\\"]"');
        });
        it('encodes an object', function () {
            const command = marshalFlags({
                copy: {from: 'asd', to: 'qwert'},
            });
            expect(command).to.be.equal('--copy-json="{\\"from\\":\\"asd\\",\\"to\\":\\"qwert\\"}"');
        });
        it('encodes an array of objects', function () {
            const command = marshalFlags({
                copy: [
                    {from: 'asd', to: 'qwert'},
                    {from: '5', to: 'v'},
                ]
            });
            expect(command).to.be.equal('--copy-json="[{\\"from\\":\\"asd\\",\\"to\\":\\"qwert\\"},{\\"from\\":\\"5\\",\\"to\\":\\"v\\"}]"');
        });
    });
    // TODO: runjs does nto support spaces in arguments
    //      pull request: https://github.com/pawelgalazka/microargs/pull/1
    // it('marshalling back and forth', function () {
    //     const input = {
    //         wisdom: 'hello',
    //         there: 'this has spaces and \\ shaslsh / !',
    //         kool: ['aid', 'straws'],
    //         copy: [
    //             {to: 'asd', from: 'qwert y!'},
    //             {to: '5', from: 'v'},
    //         ],
    //     };
    //     const command = marshalFlags(input);
    //     console.log('command', command);
    //     const cli = stringArgv(command, 'node', 'test.js');
    //     microcli(cli)(function (g) {
    //         console.log('clied', g);
    //         parseRawFlags(g)
    //         expect(g).to.deep.equal(input);
    //     });
    // });
});
