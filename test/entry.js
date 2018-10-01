const expect = require('chai').expect;

const entry = require('./../entry.js');
const fs = require('fs');
const path = require('path');

describe('determining entry point', function () {

    let startFiles;

    beforeEach(function () {
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders'));
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders/one'));
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders/two'));
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders/three'));
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders/three/project'));
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders/four'));
        fs.mkdirSync(path.join(__dirname, 'entry-point-folders/four/project'));
        fs.writeFileSync(path.join(__dirname, 'entry-point-folders/one/index.js'), '//hello\n');
        fs.writeFileSync(path.join(__dirname, 'entry-point-folders/two/custom.js'), '//hello\n');
        fs.writeFileSync(path.join(__dirname, 'entry-point-folders/three/project/index.js'), '//hello\n');
        fs.writeFileSync(path.join(__dirname, 'entry-point-folders/four/project/custom.js'), '//hello\n');
        startFiles = crawlRoot();
    });
    afterEach(function () {
        const files = crawlRoot();
        for (const f of files) {
            fs.unlinkSync(f);
        }
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders/four/project'));
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders/four'));
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders/three/project'));
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders/three'));
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders/two'));
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders/one'));
        fs.rmdirSync(path.join(__dirname, 'entry-point-folders'));
    });

    function crawl(root, found) {
        const subs = fs.readdirSync(root);
        for (const s of subs) {
            const p = path.join(root, s);
            const stat = fs.statSync(p);
            if (stat.isFile()) {
                found.push(p);
            } else {
                crawl(p, found);
            }
        }
        return found;
    }

    function crawlRoot() {
        const root = path.join(__dirname, 'entry-point-folders');
        return crawl(root, []);
    }

    it('finds the index file and does not overwrite it', async function () {
        const found = await entry.checkIfEntryFileNeeded('project', path.join(__dirname, 'entry-point-folders', 'one'), {});
        expect(found).to.be.equal(path.join(__dirname, 'entry-point-folders', 'one', 'index.js'));
        const files = crawlRoot();
        expect(files).to.be.deep.equal(startFiles);
        expect(fs.readFileSync(found, 'utf-8')).to.be.equal('//hello\n');
    });

    it('finds the custom file and does not write an index', async function () {
        const found = await entry.checkIfEntryFileNeeded('project', path.join(__dirname, 'entry-point-folders', 'two'), {
            'entry-override': 'custom.js',
        });
        expect(found).to.be.equal(path.join(__dirname, 'entry-point-folders', 'two', 'custom.js'));
        const files = crawlRoot();
        expect(files).to.be.deep.equal(startFiles);
        try {
            fs.accessSync(path.join(__dirname, 'entry-point-folders', 'two', 'index.js'));
            expect(false).to.be.equal(true);
        } catch (err) {
            // expected to go here
        }
    });

    it('finds the index file in the project path, and creates an entry index', async function () {
        const found = await entry.checkIfEntryFileNeeded('project', path.join(__dirname, 'entry-point-folders', 'three'), {});
        expect(found).to.be.equal(path.join(__dirname, 'entry-point-folders', 'three', 'index.js'));
        const files = crawlRoot();
        expect(files.indexOf(found)).to.not.be.equal(-1);
        expect(files.length).to.be.equal(startFiles.length + 1);
        expect(fs.readFileSync(found, 'utf-8')).to.be.equal(`\nconst root = require('project\\index.js');\nmodule.exports.handler = (event, context, done) => {\n    return root.handler(event, context, done);\n};\n    `);
    });

    it('finds the custom file in the project path, and creates an entry index', async function () {
        const found = await entry.checkIfEntryFileNeeded('project', path.join(__dirname, 'entry-point-folders', 'four'), {
            'entry-override': 'custom.js',
        });
        expect(found).to.be.equal(path.join(__dirname, 'entry-point-folders', 'four', 'index.js'));
        const files = crawlRoot();
        expect(files.indexOf(found)).to.not.be.equal(-1);
        expect(files.length).to.be.equal(startFiles.length + 1);
        expect(fs.readFileSync(found, 'utf-8')).to.be.equal(`\nconst root = require('project\\custom.js');\nmodule.exports.handler = (event, context, done) => {\n    return root.handler(event, context, done);\n};\n    `);
    });

});
