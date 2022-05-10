const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

const commands = [
	new SlashCommandBuilder().setName('ping').setDescription('Check the bot is alive!'),
	new SlashCommandBuilder().setName('status').setDescription('Gives stat rundown of the server'),
    new SlashCommandBuilder().setName('restart').setDescription('Restart the server (takes a while!)'),
    new SlashCommandBuilder().setName('stop').setDescription('Stops the server'),
    new SlashCommandBuilder().setName('piss').setDescription('piss')
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);