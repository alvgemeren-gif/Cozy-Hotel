const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/keywordReactSettings.json');
const keywordReactions = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
		return Object.entries(data).map(([guildId, entries]) => [guildId, new Map(Object.entries(entries))]);
	} catch (error) {
		console.error('Failed to load keyword reaction settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		const data = {};
		for (const [guildId, entries] of keywordReactions) {
			data[guildId] = Object.fromEntries(entries);
		}

		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error('Failed to save keyword reaction settings:', error);
	}
}

function normalizeKeyword(keyword) {
	return keyword.trim().toLowerCase();
}

function getGuildKeywords(guildId) {
	if (!keywordReactions.has(guildId)) {
		keywordReactions.set(guildId, new Map());
	}

	return keywordReactions.get(guildId);
}

function parseEmojis(input) {
	return [...new Set(input.trim().split(/\s+/).filter(Boolean))].slice(0, 5);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('keywordreact')
		.setDescription('Manage automatic emoji reactions for words or messages')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add emojis that the bot reacts with when a keyword is typed')
				.addStringOption(option =>
					option
						.setName('keyword')
						.setDescription('The word or exact message to react to')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(100)
				)
				.addStringOption(option =>
					option
						.setName('emojis')
						.setDescription('One or more emojis separated by spaces')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(100)
				)
				.addBooleanOption(option =>
					option
						.setName('exact')
						.setDescription('Only react when the whole message matches the keyword')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a keyword reaction')
				.addStringOption(option =>
					option
						.setName('keyword')
						.setDescription('The keyword to remove')
						.setRequired(true)
						.setMaxLength(100)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List all keyword reactions')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('clear')
				.setDescription('Remove all keyword reactions')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;

		if (subcommand === 'add') {
			const keyword = normalizeKeyword(interaction.options.getString('keyword'));
			const emojis = parseEmojis(interaction.options.getString('emojis'));
			const exact = interaction.options.getBoolean('exact') ?? false;

			if (!keyword) {
				return interaction.reply({ content: 'Please provide a valid keyword.', ephemeral: true });
			}

			if (emojis.length === 0) {
				return interaction.reply({ content: 'Please provide at least one emoji.', ephemeral: true });
			}

			const guildKeywords = getGuildKeywords(guildId);
			guildKeywords.set(keyword, { emojis, exact });
			saveSettings();

			return interaction.reply({
				content: `I will react with ${emojis.join(' ')} when someone ${exact ? 'types exactly' : 'mentions'} \`${keyword}\`.`,
				ephemeral: true,
			});
		}

		if (subcommand === 'remove') {
			const keyword = normalizeKeyword(interaction.options.getString('keyword'));
			const guildKeywords = keywordReactions.get(guildId);

			if (!guildKeywords || !guildKeywords.has(keyword)) {
				return interaction.reply({ content: `No keyword reaction found for \`${keyword}\`.`, ephemeral: true });
			}

			guildKeywords.delete(keyword);
			if (guildKeywords.size === 0) {
				keywordReactions.delete(guildId);
			}
			saveSettings();

			return interaction.reply({ content: `Removed keyword reaction for \`${keyword}\`.`, ephemeral: true });
		}

		if (subcommand === 'list') {
			const guildKeywords = keywordReactions.get(guildId);

			if (!guildKeywords || guildKeywords.size === 0) {
				return interaction.reply({ content: 'No keyword reactions are set up for this server.', ephemeral: true });
			}

			const lines = [];
			for (const [keyword, settings] of guildKeywords) {
				lines.push(`\`${keyword}\` (${settings.exact ? 'exact' : 'contains'}) -> ${settings.emojis.join(' ')}`);
			}

			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Keyword Reactions')
				.setDescription(lines.join('\n').slice(0, 4000))
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'clear') {
			keywordReactions.delete(guildId);
			saveSettings();

			return interaction.reply({ content: 'All keyword reactions have been removed.', ephemeral: true });
		}
	},
};

async function checkKeywordAndReact(message) {
	if (message.author.bot || !message.guild) return;

	const guildKeywords = keywordReactions.get(message.guild.id);
	if (!guildKeywords || guildKeywords.size === 0) return;

	const content = normalizeKeyword(message.content);
	if (!content) return;

	for (const [keyword, settings] of guildKeywords) {
		const matches = settings.exact ? content === keyword : content.includes(keyword);
		if (!matches) continue;

		for (const emoji of settings.emojis) {
			await message.react(emoji).catch(error => {
				console.error(`Failed to react with ${emoji}:`, error);
			});
		}
	}
}

module.exports.keywordReactions = keywordReactions;
module.exports.checkKeywordAndReact = checkKeywordAndReact;
