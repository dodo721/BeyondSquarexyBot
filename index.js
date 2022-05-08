const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');

if (!token) throw new Error("Missing token from config.json!");

const client = new Client({intents: [Intents.FLAGS.GUILDS]});

client.once('ready', () => {
    console.log("Logged in!");
});

client.login(token);
