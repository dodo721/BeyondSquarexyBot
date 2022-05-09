const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');
const { spawn } = require('child_process');
const readline = require('readline');

if (!token) throw new Error("Missing token from config.json!");

let mcServerProc;

// Number representing flags, each bit is a flag, by index
let _mcFlag = 0;
const mcFlags = {
    FLAGS: ["ON", "WORKING", "STOPPING", "STARTING"],
    get: {},
    set: {}
};
mcFlags.FLAGS.forEach((flag, i) => {
    mcFlags.get[flag] = () => {
        // reduce flag to only the one bit as 0 or 1, then shift to the first bit
        return (_mcFlag & (1 << i)) >> i;
    }
    mcFlags.set[flag] = val => {
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

const setupMCServer = async () => {
    if (mcServerProc) throw new Error("Server is already running!");

    // Server is starting!
    mcFlags.set.STARTING(true);
    mcFlags.set.WORKING(true);

    // Server process
    mcServerProc = spawn('bash', ['./run.sh'], {cwd:"/home/worker/minecraft/"});

    const onLog = data => {
        process.stdout.write(data.toString());
        if (data.toString().match(/\[minecraft\/DedicatedServer\]: Done \(\d+\.\d+s\)! For help, type "help"/g)) {
            // Server has started succesfully!
            mcFlags.set.ON(true);
            mcFlags.set.STARTING(false);
            mcFlags.set.WORKING(false);
            mcEvents.trigger("serverStart");
        }
    }
    mcServerProc.stdout.on('data', data => {
        // Server is giving output
        onLog(data);
        mcEvents.trigger("serverOutput", data);
    });
    mcServerProc.stderr.on('data', data => {
        // Server is showing errors
        onLog(data);
        mcEvents.trigger("serverErr", data);
    });
    
    mcServerProc.on('close', () => {
        // Server has stopped!
        mcServerProc = null;
        mcFlags.set.ON(false);
        mcFlags.set.STOPPING(false);
        mcFlags.set.WORKING(false);
        mcEvents.trigger("serverStop");
    });

    mcEvents.trigger("serverStarting");
}

mcEvents.on("serverStart", () => {
    console.log("Server started!!");
});

mcEvents.on("serverStop", () => {
    console.log("Server stopped!!");
});

console.log("Starting server...");
setupMCServer().catch(e => {
    console.error(e);
});

const mcCommand = async (command, forceSend) => {
    if (!mcFlags.get.ON()) throw new Error ("Server is not running!");
    if (mcFlags.get.WORKING() && !forceSend) throw new Error ("Server is working!");

    mcServerProc.stdin.write(command+'\n');

    if (command === "stop") {
        // Server is stopping!
        mcFlags.set.STOPPING(true);
        mcFlags.set.WORKING(true);
        mcEvents.trigger("serverStopping");
    }

    // buffer output for a quarter of a second, then reply to HTTP request
    var buffer = [];
    var collector = function(data) {
        data = data.toString();
        buffer.push(data.split(']: ')[1]);
    };
    mcServerProc.stdout.on('data', collector);
    await new Promise(r => setTimeout(r, 250));
    mcServerProc.stdout.removeListener('data', collector);
    return buffer.join('');
}

// Terminal commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
rl.on('line', line => mcCommand(line.replace(/\n$/, "").catch(e => console.error(e))));

// Discord bot
const client = new Client({intents: [Intents.FLAGS.GUILDS]});

client.once('ready', () => {
    console.log("Logged in!");
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'ping') {
		await interaction.reply('Pong!');
	} else if (commandName == 'stop') {
        if (mcFlags.get.WORKING()) return await interaction.reply("Server is busy!");
        try {
            const response = await mcCommand('stop');
            await interaction.reply(response);
        } catch (e) {
            console.error(e);
            await interaction.reply("There was an error:\n" + e.toString());
        }
    } else if (commandName == 'restart') {
        if (mcFlags.get.WORKING()) return await interaction.reply("Server is busy!");
        if (mcFlags.get.ON()) {
            mcCommand("stop");
            interaction.reply("Restarting...");
            mcEvents.once("serverStop", () => {
                setupMCServer().catch(e => {
                    console.error(e);
                });
            });
        } else {
            setupMCServer().then(() => {
                interaction.reply("Server starting!");
            }).catch(e => {
                console.error(e);
                interaction.reply("Server failed to start!\n" + e.toString());
            });
        }
    }
});

mcEvents.on("serverStop", () => {

});

client.login(token);
