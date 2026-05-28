require('dotenv').config();
const fs = require('fs');
const http = require('http');
const path = require('path');
const deployCommands = require('./deploy/deployCommands');
const { Client, Collection, EmbedBuilder, Events, GatewayIntentBits } = require('discord.js');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.CLIENT_TOKEN || process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

if (!BOT_TOKEN) {
	throw new Error('CLIENT_TOKEN or DISCORD_TOKEN is missing. Add it to Render environment variables or to a local .env file.');
}

http.createServer((_req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('Bot is running');
}).listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
	],
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.existsSync(foldersPath) ? fs.readdirSync(foldersPath) : [];

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

deployCommands();

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.GuildMemberAdd, async member => {
	if (!WELCOME_CHANNEL_ID) {
		console.warn('WELCOME_CHANNEL_ID is not set.');
		return;
	}

	const welcomeChannel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
	if (!welcomeChannel || !welcomeChannel.isTextBased()) {
		console.warn(`Welcome channel ${WELCOME_CHANNEL_ID} was not found or is not text-based.`);
		return;
	}

	const welcomeEmbed = new EmbedBuilder()
		.setColor(0x0b1f3a)
		.setTitle('Welkom in Haven')
		.setDescription(
			`${member}, welkom in **Haven**!\n\n` +
			'Lees alsjeblieft de regels en vergeet niet je keuzerollen te kiezen.'
		)
		.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
		.setTimestamp();

	await welcomeChannel.send({
		content: `${member}`,
		embeds: [welcomeEmbed],
	});
});

client.on(Events.InteractionCreate, async interaction => {
	try {
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			await command.execute(interaction);
			return;
		}

		if (interaction.isAnySelectMenu()) {
			const [handlerName] = interaction.customId.split(':');
			const handler = interaction.client.commands.get(handlerName);

			if (handler?.handleSelectMenu) {
				await handler.handleSelectMenu(interaction);
			}
		}
	} catch (error) {
		console.error(error);

		const response = {
			content: 'Er ging iets mis bij het uitvoeren van deze actie.',
			ephemeral: true,
		};

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(response).catch(() => {});
		} else {
			await interaction.reply(response).catch(() => {});
		}
	}
});

client.login(BOT_TOKEN);
