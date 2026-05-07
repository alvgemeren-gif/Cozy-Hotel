const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const questions = require('../../utils/qotdQuestions');

const settingsPath = path.join(__dirname, '../../data/qotdSettings.json');
const qotdSettings = new Map(loadSettings());
const DEFAULT_POST_HOUR = 9;
const DEFAULT_TIMEZONE = 'Europe/Amsterdam';
const CHECK_INTERVAL = 5 * 60 * 1000;

let schedulerStarted = false;

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load QOTD settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(qotdSettings), null, 2));
	} catch (error) {
		console.error('Failed to save QOTD settings:', error);
	}
}

function getZonedDateInfo(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		hour12: false,
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

	return {
		dateKey: `${values.year}-${values.month}-${values.day}`,
		hour: Number(values.hour) % 24,
	};
}

function getNextQuestion(settings) {
	const index = settings.questionIndex % questions.length;
	settings.questionIndex = (index + 1) % questions.length;
	return {
		number: index + 1,
		text: questions[index],
	};
}

function buildQotdEmbed(question) {
	return new EmbedBuilder()
		.setColor(0xf1c40f)
		.setTitle('Question of the Day')
		.setDescription(question.text)
		.setFooter({ text: `Question ${question.number}/${questions.length}` })
		.setTimestamp();
}

async function postQotd(guild, settings, reason = 'daily') {
	const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return false;

	const question = getNextQuestion(settings);
	const { dateKey } = getZonedDateInfo(new Date(), settings.timeZone || DEFAULT_TIMEZONE);
	settings.lastPostedDate = dateKey;
	saveSettings();

	await channel.send({
		content: reason === 'manual' ? '**QOTD posted manually.**' : '**New daily QOTD!**',
		embeds: [buildQotdEmbed(question)],
	});

	return true;
}

async function checkQotdPosts(client) {
	for (const [guildId, settings] of qotdSettings) {
		const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) continue;

		const timeZone = settings.timeZone || DEFAULT_TIMEZONE;
		const { dateKey, hour } = getZonedDateInfo(new Date(), timeZone);
		const postHour = Number.isInteger(settings.postHour) ? settings.postHour : DEFAULT_POST_HOUR;

		if (settings.lastPostedDate === dateKey || hour < postHour) continue;

		await postQotd(guild, settings).catch(error => {
			console.error(`Failed to post QOTD for guild ${guildId}:`, error);
		});
	}
}

function startQotdScheduler(client) {
	if (schedulerStarted) return;
	schedulerStarted = true;

	checkQotdPosts(client).catch(error => console.error('QOTD scheduler check failed:', error));
	setInterval(() => {
		checkQotdPosts(client).catch(error => console.error('QOTD scheduler check failed:', error));
	}, CHECK_INTERVAL);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('qotd')
		.setDescription('Manage the daily Question of the Day system')
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Set the channel for daily QOTD posts')
				.addChannelOption(option =>
					option
						.setName('channel')
						.setDescription('The channel where daily questions will be posted')
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(true)
				)
				.addIntegerOption(option =>
					option
						.setName('hour')
						.setDescription('Hour of the day to post, 0-23. Default: 9')
						.setMinValue(0)
						.setMaxValue(23)
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('sendnow')
				.setDescription('Post the next QOTD immediately')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('Show the current QOTD settings')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('stop')
				.setDescription('Disable daily QOTD posts')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;

		if (subcommand === 'set') {
			const channel = interaction.options.getChannel('channel');
			const postHour = interaction.options.getInteger('hour') ?? DEFAULT_POST_HOUR;
			const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

			if (!channel.permissionsFor(botMember).has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.EmbedLinks,
			])) {
				return interaction.reply({
					content: `I need View Channel, Send Messages, and Embed Links permissions in ${channel}.`,
					ephemeral: true,
				});
			}

			const existing = qotdSettings.get(guildId) || {};
			qotdSettings.set(guildId, {
				channelId: channel.id,
				postHour,
				timeZone: existing.timeZone || DEFAULT_TIMEZONE,
				questionIndex: existing.questionIndex || 0,
				lastPostedDate: existing.lastPostedDate || null,
			});
			saveSettings();

			return interaction.reply({
				content: `QOTD will now post daily in ${channel} at **${postHour}:00** (${DEFAULT_TIMEZONE}).`,
				ephemeral: true,
			});
		}

		if (subcommand === 'sendnow') {
			const settings = qotdSettings.get(guildId);
			if (!settings) {
				return interaction.reply({ content: 'QOTD is not set up for this server yet.', ephemeral: true });
			}

			await interaction.deferReply({ ephemeral: true });
			const posted = await postQotd(interaction.guild, settings, 'manual').catch(error => {
				console.error('Failed to manually post QOTD:', error);
				return false;
			});

			return interaction.editReply(posted ? 'QOTD posted.' : 'I could not post the QOTD. Check the configured channel and my permissions.');
		}

		if (subcommand === 'status') {
			const settings = qotdSettings.get(guildId);
			if (!settings) {
				return interaction.reply({ content: 'QOTD is not set up for this server yet.', ephemeral: true });
			}

			const embed = new EmbedBuilder()
				.setColor(0x3498db)
				.setTitle('QOTD Status')
				.addFields(
					{ name: 'Channel', value: `<#${settings.channelId}>`, inline: true },
					{ name: 'Post Time', value: `${settings.postHour ?? DEFAULT_POST_HOUR}:00`, inline: true },
					{ name: 'Timezone', value: settings.timeZone || DEFAULT_TIMEZONE, inline: true },
					{ name: 'Next Question', value: `${(settings.questionIndex || 0) + 1}/${questions.length}`, inline: true },
					{ name: 'Last Posted', value: settings.lastPostedDate || 'Never', inline: true }
				)
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'stop') {
			if (!qotdSettings.has(guildId)) {
				return interaction.reply({ content: 'QOTD is not enabled for this server.', ephemeral: true });
			}

			qotdSettings.delete(guildId);
			saveSettings();

			return interaction.reply({ content: 'Daily QOTD posts have been disabled.', ephemeral: true });
		}
	},
};

module.exports.qotdSettings = qotdSettings;
module.exports.questions = questions;
module.exports.startQotdScheduler = startQotdScheduler;
