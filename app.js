require('dotenv').config(); //This will be used to store private keys
const path = require('path');
const fs = require('fs');
const http = require('http');
const deployCommands = require('./deploy/deployCommands');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const getMeme = require('./commands/getMeme/getMeme');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('Bot is running');
}).listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

const BOT_TOKEN = process.env.CLIENT_TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);


for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Register our commands
deployCommands();


client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
	// Handle button interactions for reaction roles
	if (interaction.isButton()) {
		if (interaction.customId.startsWith('reactionrole-')) {
			const roleId = interaction.customId.replace('reactionrole-', '');
			const member = interaction.member;
			const guild = interaction.guild;

			try {
				const role = await guild.roles.fetch(roleId);
				if (!role) {
					return interaction.reply({ content: 'This role no longer exists.', ephemeral: true });
				}

				if (member.roles.cache.has(roleId)) {
					// Remove the role
					await member.roles.remove(role);
					await interaction.reply({ content: `Removed the ${role.name} role from your profile.`, ephemeral: true });
				} else {
					// Add the role
					await member.roles.add(role);
					await interaction.reply({ content: `Added the ${role.name} role to your profile!`, ephemeral: true });
				}
			} catch (error) {
				console.error(error);
				await interaction.reply({ content: 'There was an error managing your roles. Make sure the bot has permission to manage roles.', ephemeral: true });
			}
			return;
		}
	}

	// Handle chat input commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.login(BOT_TOKEN);