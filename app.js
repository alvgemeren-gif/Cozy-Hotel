require('dotenv').config();
const http = require('http');
const deployCommands = require('./deploy/deployCommands');
const { Client, EmbedBuilder, Events, GatewayIntentBits } = require('discord.js');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.CLIENT_TOKEN;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

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

client.login(BOT_TOKEN);
