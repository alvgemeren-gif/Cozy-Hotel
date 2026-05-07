const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/memberBookSettings.json');
const memberBooks = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load member book settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(memberBooks), null, 2));
	} catch (error) {
		console.error('Failed to save member book settings:', error);
	}
}

function getGuildBook(guildId) {
	if (!memberBooks.has(guildId)) {
		memberBooks.set(guildId, {
			channelId: null,
			messageId: null,
			members: {},
		});
	}

	return memberBooks.get(guildId);
}

function rememberMember(member, present) {
	const book = getGuildBook(member.guild.id);
	book.members[member.id] = {
		id: member.id,
		name: member.user.tag,
		displayName: member.displayName,
		present,
		firstSeenAt: book.members[member.id]?.firstSeenAt || Date.now(),
		lastSeenAt: Date.now(),
	};
	memberBooks.set(member.guild.id, book);
	saveSettings();
	return book;
}

async function syncGuildMembers(guild) {
	const book = getGuildBook(guild.id);
	const members = await guild.members.fetch();
	const presentIds = new Set(members.keys());

	for (const member of members.values()) {
		book.members[member.id] = {
			id: member.id,
			name: member.user.tag,
			displayName: member.displayName,
			present: true,
			firstSeenAt: book.members[member.id]?.firstSeenAt || Date.now(),
			lastSeenAt: Date.now(),
		};
	}

	for (const memberData of Object.values(book.members)) {
		if (!presentIds.has(memberData.id)) {
			memberData.present = false;
		}
	}

	memberBooks.set(guild.id, book);
	saveSettings();
	return book;
}

function formatMemberLines(members) {
	return members
		.sort((a, b) => a.displayName.localeCompare(b.displayName))
		.map(member => `- ${member.displayName} (${member.name})`)
		.join('\n');
}

function truncateList(lines, emptyText) {
	if (!lines) return emptyText;
	return lines.length > 1000 ? `${lines.slice(0, 997)}...` : lines;
}

function buildBookEmbed(guild, book) {
	const members = Object.values(book.members || {});
	const currentMembers = members.filter(member => member.present);
	const formerMembers = members.filter(member => !member.present);

	return new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle(`${guild.name} Member Book`)
		.setDescription('A record of everyone who is in the server or has been here before.')
		.addFields(
			{ name: `Current Members (${currentMembers.length})`, value: truncateList(formatMemberLines(currentMembers), 'No current members recorded yet.') },
			{ name: `Former Members (${formerMembers.length})`, value: truncateList(formatMemberLines(formerMembers), 'No former members recorded yet.') },
			{ name: 'Total Recorded', value: `${members.length}`, inline: true }
		)
		.setTimestamp();
}

async function updateMemberBookMessage(guild) {
	const book = memberBooks.get(guild.id);
	if (!book?.channelId || !book?.messageId) return false;

	const channel = await guild.channels.fetch(book.channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return false;

	const message = await channel.messages.fetch(book.messageId).catch(() => null);
	if (!message) return false;

	await message.edit({ embeds: [buildBookEmbed(guild, book)] });
	return true;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('memberbook')
		.setDescription('Keep a book of everyone who is or has been in the server')
		.addSubcommand(subcommand =>
			subcommand
				.setName('setup')
				.setDescription('Create or move the member book message')
				.addChannelOption(option =>
					option
						.setName('channel')
						.setDescription('The channel where the book should be posted')
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('show')
				.setDescription('Show the member book once')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('sync')
				.setDescription('Sync all current server members into the book')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('disable')
				.setDescription('Stop updating the member book message')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'setup') {
			await interaction.deferReply({ ephemeral: true });

			const channel = interaction.options.getChannel('channel');
			const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

			if (!channel.permissionsFor(botMember).has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.EmbedLinks,
				PermissionFlagsBits.ReadMessageHistory,
			])) {
				return interaction.editReply(`I need View Channel, Send Messages, Embed Links, and Read Message History permissions in ${channel}.`);
			}

			const book = await syncGuildMembers(interaction.guild);
			const message = await channel.send({ embeds: [buildBookEmbed(interaction.guild, book)] });
			book.channelId = channel.id;
			book.messageId = message.id;
			memberBooks.set(interaction.guild.id, book);
			saveSettings();

			return interaction.editReply(`Member book created in ${channel}.`);
		}

		if (subcommand === 'show') {
			const book = getGuildBook(interaction.guild.id);
			return interaction.reply({ embeds: [buildBookEmbed(interaction.guild, book)] });
		}

		if (subcommand === 'sync') {
			await interaction.deferReply({ ephemeral: true });
			await syncGuildMembers(interaction.guild);
			await updateMemberBookMessage(interaction.guild);
			return interaction.editReply('Member book synced.');
		}

		if (subcommand === 'disable') {
			const book = getGuildBook(interaction.guild.id);
			book.channelId = null;
			book.messageId = null;
			memberBooks.set(interaction.guild.id, book);
			saveSettings();

			return interaction.reply({ content: 'Member book auto-updates have been disabled.', ephemeral: true });
		}
	},
};

async function handleMemberJoin(member) {
	rememberMember(member, true);
	await updateMemberBookMessage(member.guild).catch(error => {
		console.error('Failed to update member book after join:', error);
	});
}

async function handleMemberLeave(member) {
	rememberMember(member, false);
	await updateMemberBookMessage(member.guild).catch(error => {
		console.error('Failed to update member book after leave:', error);
	});
}

module.exports.memberBooks = memberBooks;
module.exports.handleMemberJoin = handleMemberJoin;
module.exports.handleMemberLeave = handleMemberLeave;
