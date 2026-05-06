const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/keywordRoleSettings.json');
const keywordRoles = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
		return Object.entries(data).map(([guildId, entries]) => [guildId, new Map(Object.entries(entries))]);
	} catch (error) {
		console.error('Failed to load keyword role settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		const data = {};
		for (const [guildId, entries] of keywordRoles) {
			data[guildId] = Object.fromEntries(entries);
		}

		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error('Failed to save keyword role settings:', error);
	}
}

function normalizeKeyword(keyword) {
	return keyword.trim().toLowerCase();
}

async function validateRole(interaction, role) {
	const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return 'I need the Manage Roles permission to assign keyword roles.';
	}

	if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
		return 'I need the Manage Messages permission to delete keyword trigger messages.';
	}

	if (role.id === interaction.guild.id) {
		return 'The @everyone role cannot be used as a keyword role.';
	}

	if (role.managed) {
		return `${role} is managed by an integration and cannot be assigned.`;
	}

	if (role.position >= botMember.roles.highest.position) {
		return `${role} must be lower than my highest role.`;
	}

	if (!role.editable) {
		return `${role} cannot be managed by me.`;
	}

	return null;
}

function getGuildKeywords(guildId) {
	if (!keywordRoles.has(guildId)) {
		keywordRoles.set(guildId, new Map());
	}

	return keywordRoles.get(guildId);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('keywordrole')
		.setDescription('Manage keyword-based role assignment')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a keyword that gives a role when typed')
				.addStringOption(option =>
					option
						.setName('keyword')
						.setDescription('The exact keyword to trigger the role, for example !room13')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(100)
				)
				.addRoleOption(option =>
					option
						.setName('role')
						.setDescription('The role to give when the keyword is typed')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a keyword role')
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
				.setDescription('List all keyword roles')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;

		if (subcommand === 'add') {
			const keyword = normalizeKeyword(interaction.options.getString('keyword'));
			const role = interaction.options.getRole('role');
			const validationError = await validateRole(interaction, role);

			if (!keyword) {
				return interaction.reply({ content: 'Please provide a valid keyword.', ephemeral: true });
			}

			if (validationError) {
				return interaction.reply({ content: validationError, ephemeral: true });
			}

			const guildKeywords = getGuildKeywords(guildId);
			guildKeywords.set(keyword, role.id);
			saveSettings();

			const embed = new EmbedBuilder()
				.setColor(0x2ecc71)
				.setTitle('Keyword Role Added')
				.setDescription(`When someone types \`${keyword}\`, they will receive ${role}.`)
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'remove') {
			const keyword = normalizeKeyword(interaction.options.getString('keyword'));
			const guildKeywords = keywordRoles.get(guildId);

			if (!guildKeywords || !guildKeywords.has(keyword)) {
				return interaction.reply({
					content: `No keyword role found for \`${keyword}\`.`,
					ephemeral: true,
				});
			}

			guildKeywords.delete(keyword);
			if (guildKeywords.size === 0) {
				keywordRoles.delete(guildId);
			}
			saveSettings();

			const embed = new EmbedBuilder()
				.setColor(0xe74c3c)
				.setTitle('Keyword Role Removed')
				.setDescription(`The keyword \`${keyword}\` no longer gives a role.`)
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'list') {
			const guildKeywords = keywordRoles.get(guildId);

			if (!guildKeywords || guildKeywords.size === 0) {
				return interaction.reply({
					content: 'No keyword roles are set up for this server.',
					ephemeral: true,
				});
			}

			const lines = [];
			for (const [keyword, roleId] of guildKeywords) {
				const role = interaction.guild.roles.cache.get(roleId);
				lines.push(`\`${keyword}\` -> ${role || 'Role not found'}`);
			}

			const embed = new EmbedBuilder()
				.setColor(0x3498db)
				.setTitle('Keyword Roles')
				.setDescription(lines.join('\n').slice(0, 4000))
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}
	},
};

async function checkKeywordAndAssignRole(message) {
	if (message.author.bot || !message.guild || !message.member) return;

	const guildKeywords = keywordRoles.get(message.guild.id);
	if (!guildKeywords || guildKeywords.size === 0) return;

	const messageContent = normalizeKeyword(message.content);
	if (!guildKeywords.has(messageContent)) return;

	const roleId = guildKeywords.get(messageContent);
	const role = await message.guild.roles.fetch(roleId).catch(() => null);
	await message.delete().catch(error => {
		console.error('Error deleting keyword trigger message:', error);
	});

	if (!role) {
		guildKeywords.delete(messageContent);
		if (guildKeywords.size === 0) {
			keywordRoles.delete(message.guild.id);
		}
		saveSettings();
		return;
	}

	if (message.member.roles.cache.has(role.id)) return;

	try {
		await message.member.roles.add(role, `Keyword role triggered by ${messageContent}`);

		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setDescription(`You received the **${role.name}** role in **${message.guild.name}**.`)
			.setFooter({ text: `Triggered by: ${messageContent}` })
			.setTimestamp();

		await message.author.send({ embeds: [embed] }).catch(() => {});
	} catch (error) {
		console.error('Error assigning keyword role:', error);
	}
}

module.exports.keywordRoles = keywordRoles;
module.exports.checkKeywordAndAssignRole = checkKeywordAndAssignRole;
