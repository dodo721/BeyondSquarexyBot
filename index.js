const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');
const { exec, spawn } = require('child_process');

if (!token) throw new Error("Missing token from config.json!");

// Server process
const mcServerProc = spawn('cd ~/minecraft/ && ./run.sh');

const onLog = data => {
    process.stdout.write(data.toString());
}

mcServerProc.stdout.on('data', onLog);
mcServerProc.stderr.on('data', onLog);

const mcCommand = async command => {
    mcServerProc.stdin.write(command+'\n');

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
        const response = await mcCommand('stop');
        await interaction.reply(response);
    }
});

client.login(token);
