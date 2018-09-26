# runlamb

> A simple tool to compile, package and publish TypeScript Lambda functions.

Motivation: TypeScript can be a bit burdensome to setup for small projects. Most of my lambda functions are small code bases, that do not get updated frequently. The idea is to ease the work setting up and deploying TypeScript projects to lambda so it is as fast to create a TypeScript function as it is a node8 project.

> WIP

## TODO

* Init projects
* Override tslint & tsconfig
* Push version tag
* Publish to multiple regions
* Publish with a different function name
* Probably other things too...

## Install
WIP, untested... yet
```
npm install -g https://github.com/fromkeith/runlam.git
```

## Basic Use

Compile for local use
```
runlam myfunc
```
This will execute tslint & then tsc

Compile for release
```
runlam myfunc --release
```
This will compile via linux use

Publish
```
runlam myfunc --release --publish
```

### Folder Structure

An example project would be setup in the following way:
```
package.json
myfunc/package.json
myfunc/index.ts
myfunc/node_modules/*
secondfunc/package.json
secondfunc/index.ts
```

This example project has two lambda functions: _myfunc_ and _secondfunc_.


### Creating a project
> Not yet implemented

```
runlam init
```




### Sub Commands
Any runfile.js in a subfolder will be added as subcommand.

Eg. the func/file 
```javascript
    // myfunc/runfile.js
    export test() {
        // code here
    }
```
can be run as
```bash
    run myfunc:test
```

### Configuration
Configure how the lambda func is exported

Any subfolder can contain the **runlam.json** file with the following configurations.
```json
{
    "aws": {
        "profile": "default",
        "region": "us-west-2"
    },
    "lambda": {
        "us-west-2": {
            "functionName": "override-name"
        },
        "us-east-1": {
            "functionName": "different-name"
        }
    },
    "entry": {
        "handler": "index.js"
    },
    "copy": [
        "copythesefolders"
    ]
}
```


## Reserved Names

```
node_modules
dist
init
bin
```
