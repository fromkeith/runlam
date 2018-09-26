

## Basic Use

Compile for local use
```
    run myfunc
```
This will execute tslint & then tsc

Compile for release
```
    run myfunc --release
```
This will compile via linux use

Publish
```
    run myfunc --release --publish
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