const { Client, Intents, MessageEmbed } = require('discord.js');
const { token } = require('./config.json');
const { mcCommand, mcEvents, mcFlags, setupMCServer, mcConfig } = require('./mcServer.js');
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

mcEvents.on("serverOutput", data => {
    process.stdout.write(data);
});

mcEvents.on("serverErr", data => {
    process.stderr.write(data);
})

console.log("Starting server...");
setupMCServer().catch(e => {
    console.error(e);
});

// Terminal commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
rl.on('line', line => mcCommand(line.replace(/\n$/, "")).catch(e => console.error(e)));

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

    }
});

client.login(token);
