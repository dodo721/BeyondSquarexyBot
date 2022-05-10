const { spawn } = require('child_process');

let mcConfig = {cmd:"./run.sh", cwd:"/home/minecraft/"};
let mcServerProc;

// Number representing flags, each bit is a flag, by index
let _mcFlag = 0;
// Internal setting interface
const _setMcFlags = {};
// Public facing getting interface
const mcFlags = {
    FLAGS: ["ON", "WORKING", "STOPPING", "STARTING"],
};
mcFlags.FLAGS.forEach((flag, i) => {
    mcFlags[flag] = () => {
        // reduce flag to only the one bit as 0 or 1, then shift to the first bit
        return (_mcFlag & (1 << i)) >> i;
    }
    _setMcFlags[flag] = val => {
        // Set bit at index to true
        if (val) _mcFlag = _mcFlag | (1 << i);
        // Set bit at index to false
        else _mcFlag = _mcFlag & ~(1 << i);
    }
});

const _mcEvents = {};
const mcEvents = {
    EVENTS: ["serverStarting", "serverStart", "serverStopping", "serverStop", "serverOutput", "serverErr"],
    on: (event, func) => {
        if (!_mcEvents[event]) throw new Error ("Event " + event + " does not exist!");
        if (_mcEvents[event].includes(func)) return;
        _mcEvents[event].push(func);
    },
    once: (event, func) => {
        const newFunc = (...data) => {
            func(...data);
            mcEvents.remove(event, newFunc);
        };
        mcEvents.on(event, newFunc);
    },
    remove: (event, func) => {
        if (!_mcEvents[event]) throw new Error ("Event " + event + " does not exist!");
        const index = _mcEvents[event].indexOf(func);
        if (index == -1) return;
        _mcEvents[event].splice(index, 1);
    },
    trigger: async (event, ...data) => {
        if (!_mcEvents[event]) throw new Error ("Event " + event + " does not exist!");
        _mcEvents[event].forEach(func => {
            func && func(...data);
        });
    }
};
mcEvents.EVENTS.forEach(event => {
    _mcEvents[event] = [];
});

const setupMCServer = async (config) => {
    if (mcFlags.ON()) throw new Error("Server is already running!");

    if (!config) config = mcConfig;
    let {cmd, cwd} = config;

    // Server is starting!
    _setMcFlags.STARTING(true);
    _setMcFlags.WORKING(true);

    // Server process
    mcServerProc = spawn('bash', [cmd], {cwd});

    const onLog = data => {
        if (data.toString().match(/\[minecraft\/DedicatedServer\]: Done \(\d+\.\d+s\)! For help, type "help"/g)) {
            // Server has started succesfully!
            _setMcFlags.ON(true);
            _setMcFlags.STARTING(false);
            _setMcFlags.WORKING(false);
            mcEvents.trigger("serverStart");
        }
    }
    mcServerProc.stdout.on('data', data => {
        // Server is giving output
        onLog(data);
        mcEvents.trigger("serverOutput", data.toString());
    });
    mcServerProc.stderr.on('data', data => {
        // Server is showing errors
        onLog(data);
        mcEvents.trigger("serverErr", data.toString());
    });
    
    mcServerProc.on('close', () => {
        // Server has stopped!
        mcServerProc = null;
        _setMcFlags.ON(false);
        _setMcFlags.STOPPING(false);
        _setMcFlags.STARTING(false);
        _setMcFlags.WORKING(false);
        mcEvents.trigger("serverStop");
    });

    mcEvents.trigger("serverStarting");
}

const mcCommand = async (command, forceSend) => {
    if (!mcFlags.ON()) throw new Error ("Server is not running!");
    if (mcFlags.WORKING() && !forceSend) throw new Error ("Server is working!");

    mcServerProc.stdin.write(command+'\n');

    if (command === "stop") {
        // Server is stopping!
        _setMcFlags.STOPPING(true);
        _setMcFlags.WORKING(true);
        mcEvents.trigger("serverStopping");
    }

    return new Promise((resolve, reject) => {
        let responded = false;
        mcEvents.once("serverOutput", data => {
            if (!responded) {
                responded = true;
                resolve(data);
            }
        });
        mcEvents.once("serverErr", data => {
            if (!responded) {
                responded = true;
                reject(data);
            }
        })
    })
}

module.exports = {mcCommand, mcEvents, mcFlags, setupMCServer, mcConfig};
