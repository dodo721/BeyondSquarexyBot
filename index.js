const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');
const { exec, spawn, execSync } = require('child_process');

if (!token) throw new Error("Missing token from config.json!");

let mcServerProc;
const _mcEvents = {};
const _mcFlags = {};
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

    // Server process
    mcServerProc = spawn('bash', ['./run.sh'], {cwd:"/home/worker/minecraft/"});

    const onLog = data => {
        process.stdout.write(data.toString());
        if (data.toString().match(/\[minecraft\/DedicatedServer\]: Done \(\d+\.\d+s\)! For help, type "help"/g)) {
            mcEvents.trigger("serverStart");
        }
    }
    mcServerProc.stdout.on('data', data => {
        onLog(data);
        mcEvents.trigger("serverOutput", data);
    });
    mcServerProc.stderr.on('data', data => {
        onLog(data);
        mcEvents.trigger("serverErr", data);
    });
    
    mcServerProc.on('close', () => {
        mcEvents.trigger("serverStop");
        mcServerProc = null;
    });

    mcEvents.trigger("serverStarting");
}

mcEvents.once("serverStart", () => {
    console.log("Server started!!");
});

mcEvents.on("serverStop", () => {
    console.log("Server stopped!!");
});

console.log("Starting server...");
setupMCServer().catch(e => {
    console.error(e);
});

const mcCommand = async command => {
    if (!mcServerProc) throw new Error ("Server is not running!");
    mcServerProc.stdin.write(command+'\n');
    if (command === "stop") mcEvents.trigger("serverStopping");

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
const stdin = process.openStdin();
stdin.on('data', chunk => mcCommand(chunk));

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
        try {
            const response = await mcCommand('stop');
            await interaction.reply(response);
        } catch (e) {
            console.error(e);
            await interaction.reply("There was an error:\n" + e.toString());
        }
    } else if (commandName == 'restart') {
        if (mcServerProc) {
            mcCommand("stop");
            interaction.reply("Restarting...");
            mcEvents.once("serverStop", () => {
                setupMCServer().catch(e => {
                    console.error(e);
                });
            });
        } else {
            console.log("No MCServerProc??", mcServerProc);
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
