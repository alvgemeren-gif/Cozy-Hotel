const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/leaveSettings.json');
const defaultLeaveMessage = '**{tag}** has left **{server}**. We hope to see them again.';
const requiredBotPermissions = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.EmbedLinks,
];

const goodbyeSettings = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load leave settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(goodbyeSettings), null, 2));
	} catch (error) {
		console.error('Failed to save leave settings:', error);
	}
}

function formatMessage(template, user, guild) {
	return template
		.replace(/{user}/g, user.toString())
		.replace(/{username}/g, user.username)
		.replace(/{tag}/g, user.tag)
		.replace(/{server}/g, guild.name)
		.replace(/{membercount}/g, guild.memberCount.toString());
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setleave')
		.setDescription('Set up leave messages for members who leave')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('The channel where leave messages will be sent')
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('message')
				.setDescription('Custom message. Use {user}, {username}, {tag}, {server}, or {membercount}.')
				.setRequired(false)
				.setMaxLength(1000)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction) {
		const channel = interaction.options.getChannel('channel');
		const customMessage = interaction.options.getString('message') || defaultLeaveMessage;
		const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

		if (!channel.permissionsFor(botMember).has(requiredBotPermissions)) {
			return interaction.reply({
				content: `I need View Channel, Send Messages, and Embed Links permissions in ${channel}.`,
				ephemeral: true,
			});
		}

		goodbyeSettings.set(interaction.guild.id, {
			channelId: channel.id,
			message: customMessage,
		});
		saveSettings();

		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle('Leave Messages Enabled')
			.setDescription(`Leave messages will now be sent in ${channel}.`)
			.addFields(
				{
					name: 'Message',
					value: customMessage,
				},
				{
					name: 'Available Variables',
					value: '{user} - Mentions the member\n{username} - Member username\n{tag} - Member tag\n{server} - Server name\n{membercount} - Current member count',
				}
			)
			.setTimestamp();

		return interaction.reply({ embeds: [embed], ephemeral: true });
	},
};

async function sendGoodbyeMessage(user, guild, goodbyeChannel, customMessage = defaultLeaveMessage) {
	if (!goodbyeChannel?.isTextBased()) return;

	const message = formatMessage(customMessage, user, guild);
	const embed = new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Goodbye')
		.setDescription(message)
		.setThumbnail(user.displayAvatarURL())
		.setTimestamp();

	await goodbyeChannel.send({ embeds: [embed] }).catch(console.error);
}

module.exports.goodbyeSettings = goodbyeSettings;
module.exports.sendGoodbyeMessage = sendGoodbyeMessage;
