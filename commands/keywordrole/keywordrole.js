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
			data[guildId] = {};
			for (const [keyword, roleIds] of entries) {
				data[guildId][keyword] = getRoleIds(roleIds);
			}
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

function parseKeywords(input) {
	return [...new Set(input
		.split(',')
		.map(keyword => normalizeKeyword(keyword))
		.filter(Boolean))]
		.slice(0, 10);
}

function getRoleIds(value) {
	if (Array.isArray(value)) return [...new Set(value.filter(Boolean))];
	if (typeof value === 'string') return [value];
	if (value?.roleIds && Array.isArray(value.roleIds)) return [...new Set(value.roleIds.filter(Boolean))];
	if (value?.roleId) return [value.roleId];

	return [];
}

function getRoleOptions(interaction) {
	return ['role', 'role2', 'role3', 'role4', 'role5']
		.map(name => interaction.options.getRole(name))
		.filter(Boolean);
}

async function validateRoles(interaction, roles) {
	const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return 'I need the Manage Roles permission to assign keyword roles.';
	}

	if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
		return 'I need the Manage Messages permission to delete keyword trigger messages.';
	}

	const problems = roles
		.map(role => {
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
		})
		.filter(Boolean);

	return problems.length ? problems.join('\n') : null;
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
						.setDescription('One or more exact keywords separated by commas, for example !room13, !key')
						.setRequired(true)
						.setMinLength(1)
						.setMaxLength(500)
				)
				.addRoleOption(option =>
					option
						.setName('role')
						.setDescription('The first role to give when the keyword is typed')
						.setRequired(true)
				)
				.addRoleOption(option =>
					option
						.setName('role2')
						.setDescription('The second role to give')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('role3')
						.setDescription('The third role to give')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('role4')
						.setDescription('The fourth role to give')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('role5')
						.setDescription('The fifth role to give')
						.setRequired(false)
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
			const keywords = parseKeywords(interaction.options.getString('keyword'));
			const roles = getRoleOptions(interaction);
			const validationError = await validateRoles(interaction, roles);

			if (keywords.length === 0) {
				return interaction.reply({ content: 'Please provide at least one valid keyword.', ephemeral: true });
			}

			if (validationError) {
				return interaction.reply({ content: validationError, ephemeral: true });
			}

			const guildKeywords = getGuildKeywords(guildId);
			const roleIds = [...new Set(roles.map(role => role.id))];
			for (const keyword of keywords) {
				guildKeywords.set(keyword, roleIds);
			}
			saveSettings();

			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Keyword Role Added')
				.setDescription(`When someone types ${keywords.map(keyword => `\`${keyword}\``).join(', ')}, they will receive ${roles.join(', ')}.`)
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
				.setColor(0x9c7453)
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
			for (const [keyword, storedRoleIds] of guildKeywords) {
				const roles = getRoleIds(storedRoleIds)
					.map(roleId => interaction.guild.roles.cache.get(roleId) || `Role not found (${roleId})`);
				lines.push(`\`${keyword}\` -> ${roles.join(', ') || 'No roles configured'}`);
			}

			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
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

	const roleIds = getRoleIds(guildKeywords.get(messageContent));
	const roles = (await Promise.all(
		roleIds.map(roleId => message.guild.roles.fetch(roleId).catch(() => null))
	)).filter(Boolean);

	await message.delete().catch(error => {
		console.error('Error deleting keyword trigger message:', error);
	});

	if (roles.length === 0) {
		guildKeywords.delete(messageContent);
		if (guildKeywords.size === 0) {
			keywordRoles.delete(message.guild.id);
		}
		saveSettings();
		return;
	}

	const missingRoles = roles.filter(role => !message.member.roles.cache.has(role.id));
	if (missingRoles.length === 0) return;

	try {
		await message.member.roles.add(missingRoles, `Keyword role triggered by ${messageContent}`);

		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setDescription(`You received these roles in **${message.guild.name}**: ${missingRoles.map(role => `**${role.name}**`).join(', ')}.`)
			.setFooter({ text: `Triggered by: ${messageContent}` })
			.setTimestamp();

		await message.author.send({ embeds: [embed] }).catch(() => {});
	} catch (error) {
		console.error('Error assigning keyword role:', error);
	}
}

module.exports.keywordRoles = keywordRoles;
module.exports.checkKeywordAndAssignRole = checkKeywordAndAssignRole;
