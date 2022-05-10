const { Client, Intents, MessageEmbed } = require('discord.js');
const { token } = require('./config.json');
const { mcCommand, mcEvents, mcFlags, setupMCServer, mcConfig } = require('./mcServer');
const { percentMemUsed, percentCpuUsed } = require('./pcStats');
const readline = require('readline');

if (!token) throw new Error("Missing token from config.json!");

mcConfig.cmd = "./run.sh";
mcConfig.cwd = "/home/worker/minecraft/";

// SERVER STUFF
mcEvents.on("serverStart", () => {
    console.log("Server started!!");
});

mcEvents.on("serverStop", () => {
    console.log("Server stopped!!");
});

// Logging can be paused and buffered when a command requires input
let _pauseLog = false;
let _logBuffer = "";
const setLogPause = pause => {
    _pauseLog = pause;
    if (!pause) {
        process.stdout.write(_logBuffer);
        _logBuffer = "";
    }
};
mcEvents.on("serverOutput", data => {
    if (!_pauseLog) process.stdout.write(data);
    else _logBuffer += data + "\n";
});

// Server errors cannot be paused
mcEvents.on("serverErr", data => {
    process.stderr.write(data);
})

/*console.log("Starting server...");
setupMCServer().catch(e => {
    console.error(e);
});*/

let tempInputCapture = null;

const onInput = input => {
    if (tempInputCapture) {
        tempInputCapture(input);
        tempInputCapture = null;
    } else mcCommand(input).catch(e => console.error(e));
}

// Terminal commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
rl.on('line', line => onInput(line.replace(/\n$/, "")));

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
        if (mcFlags.WORKING()) return await interaction.reply("Server is busy!");
        try {
            const response = await mcCommand('stop');
            await interaction.reply(response);
        } catch (e) {
            console.error(e);
            await interaction.reply("There was an error:\n" + e.toString());
        }
    } else if (commandName == 'restart') {
        if (mcFlags.WORKING()) return await interaction.reply("Server is busy!");
        if (mcFlags.ON()) {
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
    } else if (commandName == 'status') {
        const mem = percentMemUsed();
        const cpu = percentCpuUsed();
        interaction.reply("Memory: " + mem + "%\nCPU: " + cpu + "%");
    }
});

client.login(token);

const exitHandler = () => {
    if (mcFlags.ON() || mcFlags.WORKING()) {
        setLogPause(true);
        console.log("The server is currently unsafe to terminate! Continue? (y/n)");
        tempInputCapture = input => {
            setLogPause(false);
            if (input.toLowerCase() === "y" || input.toLowerCase() === "yes") {
                console.log("Bye bye!");
                process.exit();
            }
        }
    } else process.exit();
};

process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
process.on('SIGHUP', exitHandler);
