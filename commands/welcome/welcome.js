const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/welcomeSettings.json');
const defaultWelcomeMessage = 'Welcome {user} to **{server}**! We are happy to have you here.';
const requiredBotPermissions = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.EmbedLinks,
];

const welcomeSettings = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load welcome settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(welcomeSettings), null, 2));
	} catch (error) {
		console.error('Failed to save welcome settings:', error);
	}
}

function formatMessage(template, member) {
	return template
		.replace(/{user}/g, member.toString())
		.replace(/{username}/g, member.user.username)
		.replace(/{tag}/g, member.user.tag)
		.replace(/{server}/g, member.guild.name)
		.replace(/{membercount}/g, member.guild.memberCount.toString());
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setwelcome')
		.setDescription('Set up welcome messages for new members')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('The channel where welcome messages will be sent')
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('message')
				.setDescription('Custom message. Use {user}, {username}, {server}, or {membercount}.')
				.setRequired(false)
				.setMaxLength(1000)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction) {
		const channel = interaction.options.getChannel('channel');
		const customMessage = interaction.options.getString('message') || defaultWelcomeMessage;
		const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

		if (!channel.permissionsFor(botMember).has(requiredBotPermissions)) {
			return interaction.reply({
				content: `I need View Channel, Send Messages, and Embed Links permissions in ${channel}.`,
				ephemeral: true,
			});
		}

		welcomeSettings.set(interaction.guild.id, {
			channelId: channel.id,
			message: customMessage,
		});
		saveSettings();

		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle('Welcome Messages Enabled')
			.setDescription(`Welcome messages will now be sent in ${channel}.`)
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

async function sendWelcomeMessage(member, welcomeChannel, customMessage = defaultWelcomeMessage) {
	if (!welcomeChannel?.isTextBased()) return;

	const message = formatMessage(customMessage, member);
	const embed = new EmbedBuilder()
		.setColor(0x2ecc71)
		.setTitle('Welcome')
		.setDescription(message)
		.setThumbnail(member.user.displayAvatarURL())
		.setTimestamp();

	await welcomeChannel.send({ embeds: [embed] }).catch(console.error);
}

module.exports.welcomeSettings = welcomeSettings;
module.exports.sendWelcomeMessage = sendWelcomeMessage;
