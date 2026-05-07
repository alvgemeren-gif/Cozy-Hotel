const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../../data/roleCleanupSettings.json');
const roleCleanupSettings = new Map(loadSettings());

function loadSettings() {
	try {
		if (!fs.existsSync(settingsPath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
	} catch (error) {
		console.error('Failed to load role cleanup settings:', error);
		return [];
	}
}

function saveSettings() {
	try {
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, JSON.stringify(Object.fromEntries(roleCleanupSettings), null, 2));
	} catch (error) {
		console.error('Failed to save role cleanup settings:', error);
	}
}

function getGuildRules(guildId) {
	if (!roleCleanupSettings.has(guildId)) {
		roleCleanupSettings.set(guildId, {});
	}

	return roleCleanupSettings.get(guildId);
}

function getRoleOptions(interaction) {
	return ['remove_role', 'remove_role2', 'remove_role3', 'remove_role4', 'remove_role5']
		.map(name => interaction.options.getRole(name))
		.filter(Boolean);
}

async function validateRoles(interaction, triggerRole, removeRoles) {
	const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return 'I need the Manage Roles permission to remove roles.';
	}

	if (triggerRole.id === interaction.guild.id || removeRoles.some(role => role.id === interaction.guild.id)) {
		return 'The @everyone role cannot be used in role cleanup rules.';
	}

	if (removeRoles.some(role => role.id === triggerRole.id)) {
		return 'The trigger role cannot also be one of the roles to remove.';
	}

	const problems = removeRoles
		.map(role => {
			if (role.managed) return `${role} is managed by an integration and cannot be removed by me.`;
			if (role.position >= botMember.roles.highest.position) return `${role} must be lower than my highest role.`;
			if (!role.editable) return `${role} cannot be managed by me.`;
			return null;
		})
		.filter(Boolean);

	return problems.length ? problems.join('\n') : null;
}

function buildRuleList(guild, rules) {
	const lines = Object.entries(rules).map(([triggerRoleId, removeRoleIds]) => {
		const triggerRole = guild.roles.cache.get(triggerRoleId);
		const removeRoles = removeRoleIds.map(roleId => guild.roles.cache.get(roleId) || `Role not found (${roleId})`);

		return `${triggerRole || `Role not found (${triggerRoleId})`} removes: ${removeRoles.join(', ')}`;
	});

	return lines.length ? lines.join('\n') : 'No role cleanup rules are configured.';
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rolecleanup')
		.setDescription('Remove roles automatically when someone has a specific role')
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Set roles to remove when someone has a trigger role')
				.addRoleOption(option =>
					option
						.setName('trigger_role')
						.setDescription('When someone has this role, the other roles are removed')
						.setRequired(true)
				)
				.addRoleOption(option =>
					option
						.setName('remove_role')
						.setDescription('First role to remove')
						.setRequired(true)
				)
				.addRoleOption(option =>
					option
						.setName('remove_role2')
						.setDescription('Second role to remove')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('remove_role3')
						.setDescription('Third role to remove')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('remove_role4')
						.setDescription('Fourth role to remove')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option
						.setName('remove_role5')
						.setDescription('Fifth role to remove')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove one cleanup rule')
				.addRoleOption(option =>
					option
						.setName('trigger_role')
						.setDescription('The trigger role rule to remove')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List all role cleanup rules')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('clear')
				.setDescription('Remove all role cleanup rules')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;

		if (subcommand === 'set') {
			const triggerRole = interaction.options.getRole('trigger_role');
			const removeRoles = getRoleOptions(interaction);
			const validationError = await validateRoles(interaction, triggerRole, removeRoles);

			if (validationError) {
				return interaction.reply({ content: validationError, ephemeral: true });
			}

			const rules = getGuildRules(guildId);
			rules[triggerRole.id] = [...new Set(removeRoles.map(role => role.id))];
			roleCleanupSettings.set(guildId, rules);
			saveSettings();

			await cleanupMembersWithRole(interaction.guild, triggerRole.id);

			return interaction.reply({
				content: `When someone has ${triggerRole}, I will remove: ${removeRoles.join(', ')}.`,
				ephemeral: true,
			});
		}

		if (subcommand === 'remove') {
			const triggerRole = interaction.options.getRole('trigger_role');
			const rules = getGuildRules(guildId);

			if (!rules[triggerRole.id]) {
				return interaction.reply({ content: `No cleanup rule exists for ${triggerRole}.`, ephemeral: true });
			}

			delete rules[triggerRole.id];
			if (Object.keys(rules).length === 0) {
				roleCleanupSettings.delete(guildId);
			} else {
				roleCleanupSettings.set(guildId, rules);
			}
			saveSettings();

			return interaction.reply({ content: `Removed the cleanup rule for ${triggerRole}.`, ephemeral: true });
		}

		if (subcommand === 'list') {
			const rules = roleCleanupSettings.get(guildId) || {};
			const embed = new EmbedBuilder()
				.setColor(0x9c7453)
				.setTitle('Role Cleanup Rules')
				.setDescription(buildRuleList(interaction.guild, rules))
				.setTimestamp();

			return interaction.reply({ embeds: [embed], ephemeral: true });
		}

		if (subcommand === 'clear') {
			roleCleanupSettings.delete(guildId);
			saveSettings();

			return interaction.reply({ content: 'All role cleanup rules have been removed.', ephemeral: true });
		}
	},
};

async function handleMemberRoleCleanup(member) {
	const rules = roleCleanupSettings.get(member.guild.id);
	if (!rules || Object.keys(rules).length === 0) return;

	const roleIdsToRemove = new Set();
	for (const [triggerRoleId, removeRoleIds] of Object.entries(rules)) {
		if (!member.roles.cache.has(triggerRoleId)) continue;

		for (const roleId of removeRoleIds) {
			if (member.roles.cache.has(roleId)) {
				roleIdsToRemove.add(roleId);
			}
		}
	}

	if (roleIdsToRemove.size === 0) return;

	const roles = [...roleIdsToRemove]
		.map(roleId => member.guild.roles.cache.get(roleId))
		.filter(Boolean);

	if (roles.length === 0) return;

	await member.roles.remove(roles, 'Role cleanup rule').catch(error => {
		console.error(`Failed to clean up roles for ${member.user.tag}:`, error);
	});
}

async function cleanupMembersWithRole(guild, triggerRoleId) {
	const role = guild.roles.cache.get(triggerRoleId) || await guild.roles.fetch(triggerRoleId).catch(() => null);
	if (!role) return;

	for (const member of role.members.values()) {
		await handleMemberRoleCleanup(member);
	}
}

module.exports.roleCleanupSettings = roleCleanupSettings;
module.exports.handleMemberRoleCleanup = handleMemberRoleCleanup;
