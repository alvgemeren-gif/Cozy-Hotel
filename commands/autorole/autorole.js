const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/autoroleSettings.json');
const autoroleSettings = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load autorole settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(autoroleSettings), null, 2));
	} catch (error) {
		console.error('Failed to save autorole settings:', error);
	}
}

function getConfiguredRoleIds(guildId) {
	const settings = autoroleSettings.get(guildId);

	if (!settings) return [];
	if (Array.isArray(settings.roleIds)) return settings.roleIds;
	if (settings.roleId) return [settings.roleId];

	return [];
}

function getRoleOptions(interaction) {
	return ['role', 'role2', 'role3', 'role4', 'role5']
		.map(name => interaction.options.getRole(name))
		.filter(Boolean);
}

function findRoleProblem(role, botMember) {
	if (role.managed) return `${role} is managed by an integration and cannot be assigned.`;
	if (role.id === role.guild.id) return 'The @everyone role cannot be used as an autorole.';
	if (role.position >= botMember.roles.highest.position) {
		return `${role} must be lower than my highest role.`;
	}
	if (!role.editable) return `${role} cannot be managed by me.`;

	return null;
}

async function validateRoles(interaction, roles) {
	const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return 'I need the Manage Roles permission to assign autoroles.';
	}

	const problems = roles
		.map(role => findRoleProblem(role, botMember))
		.filter(Boolean);

	return problems.length ? problems.join('\n') : null;
}

function saveRoleIds(guildId, roleIds) {
	const uniqueRoleIds = [...new Set(roleIds)];

	if (uniqueRoleIds.length === 0) {
		autoroleSettings.delete(guildId);
	} else {
		autoroleSettings.set(guildId, { roleIds: uniqueRoleIds });
	}

	saveSettings();
	return uniqueRoleIds;
}

function buildRolesDescription(roleIds, guild) {
	const roles = roleIds
		.map(roleId => guild.roles.cache.get(roleId))
		.filter(Boolean);

	return roles.length
		? roles.map(role => `${role} (${role.id})`).join('\n')
		: 'No valid autoroles are configured.';
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('autorole')
		.setDescription('Manage automatic role assignment for new members')
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Replace the autorole list with up to 5 roles')
				.addRoleOption(option =>
					option
						.setName('role')
						.setDescription('First role to automatically assign')
						.setRequired(true)
				)
				.addRoleOption(option =>
					option
						.setName('role2')
						.setDescription('Second role to automatically assign')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('role3')
						.setDescription('Third role to automatically assign')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('role4')
						.setDescription('Fourth role to automatically assign')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('role5')
						.setDescription('Fifth role to automatically assign')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add one role to the autorole list')
				.addRoleOption(option =>
					option
						.setName('role')
						.setDescription('The role to add')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove one role from the autorole list')
				.addRoleOption(option =>
					option
						.setName('role')
						.setDescription('The role to remove')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('clear')
				.setDescription('Remove all autoroles')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('show')
				.setDescription('Show the current autoroles')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;

		if (subcommand === 'set') {
			const roles = getRoleOptions(interaction);
			const validationError = await validateRoles(interaction, roles);

			if (validationError) {
				return interaction.reply({ content: validationError, ephemeral: true });
			}

			const roleIds = saveRoleIds(guildId, roles.map(role => role.id));
			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Autoroles Updated')
				.setDescription('New members will now automatically receive these roles:')
				.addFields({ name: 'Roles', value: buildRolesDescription(roleIds, interaction.guild) })
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'add') {
			const role = interaction.options.getRole('role');
			const validationError = await validateRoles(interaction, [role]);

			if (validationError) {
				return interaction.reply({ content: validationError, ephemeral: true });
			}

			const currentRoleIds = getConfiguredRoleIds(guildId);
			if (currentRoleIds.includes(role.id)) {
				return interaction.reply({ content: `${role} is already in the autorole list.`, ephemeral: true });
			}

			const roleIds = saveRoleIds(guildId, [...currentRoleIds, role.id]);
			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Autorole Added')
				.setDescription(`${role} was added to the autorole list.`)
				.addFields({ name: 'Current Roles', value: buildRolesDescription(roleIds, interaction.guild) })
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'remove') {
			const role = interaction.options.getRole('role');
			const currentRoleIds = getConfiguredRoleIds(guildId);

			if (!currentRoleIds.includes(role.id)) {
				return interaction.reply({ content: `${role} is not in the autorole list.`, ephemeral: true });
			}

			const roleIds = saveRoleIds(guildId, currentRoleIds.filter(roleId => roleId !== role.id));
			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Autorole Removed')
				.setDescription(`${role} was removed from the autorole list.`)
				.addFields({ name: 'Current Roles', value: buildRolesDescription(roleIds, interaction.guild) })
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'clear') {
			if (!autoroleSettings.has(guildId)) {
				return interaction.reply({ content: 'No autoroles are configured for this server.', ephemeral: true });
			}

			saveRoleIds(guildId, []);

			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Autoroles Cleared')
				.setDescription('New members will no longer receive automatic roles.')
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'show') {
			const roleIds = getConfiguredRoleIds(guildId);

			if (roleIds.length === 0) {
				return interaction.reply({ content: 'No autoroles are configured for this server.', ephemeral: true });
			}

			const validRoleIds = roleIds.filter(roleId => interaction.guild.roles.cache.has(roleId));
			if (validRoleIds.length !== roleIds.length) {
				saveRoleIds(guildId, validRoleIds);
			}

			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Current Autoroles')
				.setDescription('New members automatically receive these roles:')
				.addFields({ name: 'Roles', value: buildRolesDescription(validRoleIds, interaction.guild) })
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}
	},
};

async function assignAutorole(member) {
	const guildId = member.guild.id;
	const roleIds = getConfiguredRoleIds(guildId);

	if (roleIds.length === 0) return;

	const roles = roleIds
		.map(roleId => member.guild.roles.cache.get(roleId))
		.filter(Boolean);

	if (roles.length !== roleIds.length) {
		saveRoleIds(guildId, roles.map(role => role.id));
	}

	if (roles.length === 0) return;

	try {
		await member.roles.add(roles, 'Autoroles for new member');
		console.log(`Assigned autoroles to ${member.user.tag} in ${member.guild.name}: ${roles.map(role => role.name).join(', ')}`);
	} catch (error) {
		console.error(`Failed to assign autoroles to ${member.user.tag}:`, error);
	}
}

module.exports.autoroleSettings = autoroleSettings;
module.exports.assignAutorole = assignAutorole;
