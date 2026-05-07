const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/ghostSettings.json');
const ghostSettings = new Map(loadSettings());
const CHECK_INTERVAL = 10 * 60 * 1000;
const DEFAULT_MINUTES = 180;

let schedulerStarted = false;

const ghostMessages = [
	'The lights flickered again.',
	'Did someone call my name?',
	'I found a key, but not the door.',
	'Room 13 is colder than yesterday.',
	'The hallway remembers your footsteps.',
	'Do not trust the mirror after midnight.',
	'Someone left the elevator on the wrong floor.',
	'I heard music from an empty ballroom.',
	'The clock stopped, but the night continued.',
	'There is dust where nobody walked.',
	'The lobby smells like rain.',
	'A whisper came through the walls.',
	'The guest book wrote back.',
	'One candle went out by itself.',
	'The basement door is breathing.',
	'Something moved behind the curtains.',
	'The old piano played one note.',
	'Your shadow arrived before you did.',
	'The carpet knows too much.',
	'I am not alone in here.',
	'Someone knocked from inside the wardrobe.',
	'The portrait blinked.',
	'The corridor got longer.',
	'There are footsteps above the top floor.',
	'I left a message under the floorboards.',
];

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load ghost settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(ghostSettings), null, 2));
	} catch (error) {
		console.error('Failed to save ghost settings:', error);
	}
}

function getRandomGhostMessage() {
	return ghostMessages[Math.floor(Math.random() * ghostMessages.length)];
}

function getNextGhostTime(minutes) {
	const minimumDelay = Math.max(15, Math.floor(minutes * 0.5));
	const maximumDelay = Math.max(minimumDelay + 1, Math.floor(minutes * 1.5));
	const delayMinutes = Math.floor(Math.random() * (maximumDelay - minimumDelay + 1)) + minimumDelay;

	return Date.now() + (delayMinutes * 60 * 1000);
}

async function sendGhostMessage(guild, channelId, message, reason = 'Ghost message') {
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return false;

	const botMember = guild.members.me || await guild.members.fetchMe();
	if (!channel.permissionsFor(botMember).has([
		PermissionFlagsBits.ViewChannel,
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.ManageWebhooks,
	])) {
		return false;
	}

	const webhook = await channel.createWebhook({
		name: 'Ghost',
		reason,
	});

	await webhook.send({
		content: message,
		username: 'Ghost',
		avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
		allowedMentions: { parse: [] },
	});

	await webhook.delete('Ghost message sent');
	return true;
}

async function checkGhostMessages(client) {
	const now = Date.now();

	for (const [guildId, settings] of ghostSettings) {
		if (!settings.enabled || !settings.channelId) continue;
		if (settings.nextAt && settings.nextAt > now) continue;

		const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) continue;

		const sent = await sendGhostMessage(guild, settings.channelId, getRandomGhostMessage(), 'Automatic ghost message').catch(error => {
			console.error(`Failed to send automatic ghost message for guild ${guildId}:`, error);
			return false;
		});

		settings.nextAt = getNextGhostTime(settings.minutes || DEFAULT_MINUTES);
		ghostSettings.set(guildId, settings);
		saveSettings();

		if (!sent) {
			console.warn(`Ghost message was skipped for guild ${guildId}. Check channel permissions.`);
		}
	}
}

function startGhostScheduler(client) {
	if (schedulerStarted) return;
	schedulerStarted = true;

	checkGhostMessages(client).catch(error => console.error('Ghost scheduler check failed:', error));
	setInterval(() => {
		checkGhostMessages(client).catch(error => console.error('Ghost scheduler check failed:', error));
	}, CHECK_INTERVAL);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ghostmessage')
		.setDescription('Let the ghost send messages')
		.addSubcommand(subcommand =>
			subcommand
				.setName('send')
				.setDescription('Let the ghost send a message now')
				.addStringOption(option =>
					option
						.setName('message')
						.setDescription('The message the ghost should send')
						.setRequired(true)
						.setMaxLength(2000)
				)
				.addChannelOption(option =>
					option
						.setName('channel')
						.setDescription('Where the ghost should send the message')
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('autoset')
				.setDescription('Enable random vague ghost messages')
				.addChannelOption(option =>
					option
						.setName('channel')
						.setDescription('Where the ghost should randomly speak')
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(true)
				)
				.addIntegerOption(option =>
					option
						.setName('minutes')
						.setDescription('Average minutes between messages. Default: 180')
						.setMinValue(15)
						.setMaxValue(1440)
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('autostop')
				.setDescription('Disable random ghost messages')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('Show automatic ghost message settings')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('sendrandom')
				.setDescription('Send one random ghost message now')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'send') {
			await interaction.deferReply({ ephemeral: true });

			const message = interaction.options.getString('message');
			const channel = interaction.options.getChannel('channel') || interaction.channel;
			const sent = await sendGhostMessage(interaction.guild, channel.id, message, `Ghost message requested by ${interaction.user.tag}`).catch(error => {
				console.error('Error sending ghost message:', error);
				return false;
			});

			return interaction.editReply({
				content: sent ? `The ghost sent your message in ${channel}.` : 'The ghost could not send that message. Please check my channel permissions.',
			});
		}

		if (subcommand === 'autoset') {
			const channel = interaction.options.getChannel('channel');
			const minutes = interaction.options.getInteger('minutes') || DEFAULT_MINUTES;
			const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

			if (!channel.permissionsFor(botMember).has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ManageWebhooks,
			])) {
				return interaction.reply({
					content: `I need View Channel, Send Messages, and Manage Webhooks permissions in ${channel}.`,
					ephemeral: true,
				});
			}

			ghostSettings.set(interaction.guild.id, {
				enabled: true,
				channelId: channel.id,
				minutes,
				nextAt: getNextGhostTime(minutes),
			});
			saveSettings();

			return interaction.reply({
				content: `The ghost will now randomly speak in ${channel}, about every **${minutes}** minutes.`,
				ephemeral: true,
			});
		}

		if (subcommand === 'autostop') {
			ghostSettings.delete(interaction.guild.id);
			saveSettings();

			return interaction.reply({
				content: 'The ghost will stop sending random messages.',
				ephemeral: true,
			});
		}

		if (subcommand === 'status') {
			const settings = ghostSettings.get(interaction.guild.id);
			if (!settings?.enabled) {
				return interaction.reply({ content: 'Automatic ghost messages are disabled.', ephemeral: true });
			}

			const nextTimestamp = Math.floor((settings.nextAt || Date.now()) / 1000);
			return interaction.reply({
				content: `The ghost is active in <#${settings.channelId}> about every **${settings.minutes || DEFAULT_MINUTES}** minutes.\nNext message: <t:${nextTimestamp}:R>`,
				ephemeral: true,
			});
		}

		if (subcommand === 'sendrandom') {
			await interaction.deferReply({ ephemeral: true });

			const settings = ghostSettings.get(interaction.guild.id);
			const channelId = settings?.channelId || interaction.channel.id;
			const sent = await sendGhostMessage(interaction.guild, channelId, getRandomGhostMessage(), `Random ghost message requested by ${interaction.user.tag}`).catch(error => {
				console.error('Error sending random ghost message:', error);
				return false;
			});

			return interaction.editReply({
				content: sent ? 'The ghost whispered something.' : 'The ghost could not speak. Please check my channel permissions.',
			});
		}
	},
};

module.exports.ghostSettings = ghostSettings;
module.exports.startGhostScheduler = startGhostScheduler;
