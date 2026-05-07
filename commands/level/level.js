const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '../../data/levels.json');
const rewardsPath = path.join(__dirname, '../../data/levelRewards.json');
const settingsPath = path.join(__dirname, '../../data/levelSettings.json');
const levelData = new Map(loadMap(levelsPath));
const levelRewards = new Map(loadRewards());
const levelSettings = new Map(loadMap(settingsPath));
const xpCooldowns = new Map();

const XP_COOLDOWN = 60 * 1000;
const MIN_XP = 15;
const MAX_XP = 25;

function loadMap(filePath) {
	try {
		if (!fs.existsSync(filePath)) return [];
		return Object.entries(JSON.parse(fs.readFileSync(filePath, 'utf8')));
	} catch (error) {
		console.error(`Failed to load ${filePath}:`, error);
		return [];
	}
}

function loadRewards() {
	try {
		if (!fs.existsSync(rewardsPath)) return [];
		const data = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
		return Object.entries(data).map(([guildId, rewards]) => [guildId, new Map(Object.entries(rewards))]);
	} catch (error) {
		console.error('Failed to load level rewards:', error);
		return [];
	}
}

function saveJson(filePath, data) {
	try {
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error(`Failed to save ${filePath}:`, error);
	}
}

function saveLevels() {
	saveJson(levelsPath, Object.fromEntries(levelData));
}

function saveRewards() {
	const data = {};
	for (const [guildId, rewards] of levelRewards) {
		data[guildId] = Object.fromEntries(rewards);
	}
	saveJson(rewardsPath, data);
}

function saveSettings() {
	saveJson(settingsPath, Object.fromEntries(levelSettings));
}

function getGuildLevels(guildId) {
	if (!levelData.has(guildId)) {
		levelData.set(guildId, {});
	}
	return levelData.get(guildId);
}

function getUserLevelData(guildId, userId) {
	const guildLevels = getGuildLevels(guildId);
	if (!guildLevels[userId]) {
		guildLevels[userId] = { xp: 0, level: 0, messages: 0 };
	}
	return guildLevels[userId];
}

function getGuildRewards(guildId) {
	if (!levelRewards.has(guildId)) {
		levelRewards.set(guildId, new Map());
	}
	return levelRewards.get(guildId);
}

function getRequiredXp(level) {
	return 100 + (level * 50);
}

function getTotalXpForLevel(level) {
	let total = 0;
	for (let currentLevel = 0; currentLevel < level; currentLevel++) {
		total += getRequiredXp(currentLevel);
	}
	return total;
}

function getRandomXp() {
	return Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;
}

function getRank(guildId, userId) {
	const guildLevels = getGuildLevels(guildId);
	const sorted = Object.entries(guildLevels)
		.sort(([, a], [, b]) => (getTotalXpForLevel(b.level) + b.xp) - (getTotalXpForLevel(a.level) + a.xp));

	const index = sorted.findIndex(([rankedUserId]) => rankedUserId === userId);
	return index === -1 ? null : index + 1;
}

async function validateRole(interaction, role) {
	const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return 'I need the Manage Roles permission to assign level rewards.';
	}

	if (role.id === interaction.guild.id) return 'The @everyone role cannot be used as a level reward.';
	if (role.managed) return `${role} is managed by an integration and cannot be assigned.`;
	if (role.position >= botMember.roles.highest.position) return `${role} must be lower than my highest role.`;
	if (!role.editable) return `${role} cannot be managed by me.`;

	return null;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('Level system and role reward commands')
		.addSubcommand(subcommand =>
			subcommand
				.setName('rank')
				.setDescription('Show your level and XP')
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('The user to check')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('rewards')
				.setDescription('Show level role rewards')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('addreward')
				.setDescription('Add a role reward for a level')
				.addIntegerOption(option =>
					option
						.setName('level')
						.setDescription('The level required for this role')
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(500)
				)
				.addRoleOption(option =>
					option
						.setName('role')
						.setDescription('The role to give at this level')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('removereward')
				.setDescription('Remove a level role reward')
				.addIntegerOption(option =>
					option
						.setName('level')
						.setDescription('The reward level to remove')
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(500)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('clearrewards')
				.setDescription('Remove all level role rewards')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('setchannel')
				.setDescription('Set the channel for level-up messages')
				.addChannelOption(option =>
					option
						.setName('channel')
						.setDescription('The channel where level-up messages will be posted')
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('clearchannel')
				.setDescription('Send level-up messages in the channel where users level up')
		),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;

		if (subcommand === 'rank') {
			const targetUser = interaction.options.getUser('user') || interaction.user;
			const userData = getUserLevelData(guildId, targetUser.id);
			const requiredXp = getRequiredXp(userData.level);
			const rank = getRank(guildId, targetUser.id) || 'Unranked';

			const embed = new EmbedBuilder()
				.setColor(0x3498db)
				.setTitle(`${targetUser.username}'s Level`)
				.setThumbnail(targetUser.displayAvatarURL())
				.addFields(
					{ name: 'Level', value: `${userData.level}`, inline: true },
					{ name: 'XP', value: `${userData.xp}/${requiredXp}`, inline: true },
					{ name: 'Rank', value: `${rank}`, inline: true },
					{ name: 'Messages', value: `${userData.messages || 0}`, inline: true }
				)
				.setTimestamp();

			return interaction.reply({ embeds: [embed] });
		}

		if (subcommand === 'rewards') {
			const rewards = getGuildRewards(guildId);
			const lines = [...rewards.entries()]
				.sort(([a], [b]) => Number(a) - Number(b))
				.map(([level, roleId]) => `Level **${level}** -> ${interaction.guild.roles.cache.get(roleId) || 'Role not found'}`);

			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(0x3498db)
						.setTitle('Level Rewards')
						.setDescription(lines.length ? lines.join('\n') : 'No level rewards are configured.')
						.setTimestamp(),
				],
			});
		}

		if (subcommand === 'addreward') {
			if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
				return interaction.reply({ content: 'You need Manage Roles to configure level rewards.', ephemeral: true });
			}

			const level = interaction.options.getInteger('level');
			const role = interaction.options.getRole('role');
			const validationError = await validateRole(interaction, role);

			if (validationError) {
				return interaction.reply({ content: validationError, ephemeral: true });
			}

			getGuildRewards(guildId).set(String(level), role.id);
			saveRewards();

			return interaction.reply({
				content: `${role} will now be awarded at level **${level}**.`,
				ephemeral: true,
			});
		}

		if (subcommand === 'removereward') {
			if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
				return interaction.reply({ content: 'You need Manage Roles to configure level rewards.', ephemeral: true });
			}

			const level = String(interaction.options.getInteger('level'));
			const rewards = getGuildRewards(guildId);

			if (!rewards.has(level)) {
				return interaction.reply({ content: `There is no reward configured for level **${level}**.`, ephemeral: true });
			}

			rewards.delete(level);
			saveRewards();

			return interaction.reply({ content: `Removed the reward for level **${level}**.`, ephemeral: true });
		}

		if (subcommand === 'clearrewards') {
			if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
				return interaction.reply({ content: 'You need Manage Roles to configure level rewards.', ephemeral: true });
			}

			levelRewards.delete(guildId);
			saveRewards();

			return interaction.reply({ content: 'All level rewards have been removed.', ephemeral: true });
		}

		if (subcommand === 'setchannel') {
			if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
				return interaction.reply({ content: 'You need Manage Server to configure the level-up channel.', ephemeral: true });
			}

			const channel = interaction.options.getChannel('channel');
			const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

			if (!channel.permissionsFor(botMember).has([
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
			])) {
				return interaction.reply({
					content: `I need View Channel and Send Messages permissions in ${channel}.`,
					ephemeral: true,
				});
			}

			const settings = levelSettings.get(guildId) || {};
			settings.levelUpChannelId = channel.id;
			levelSettings.set(guildId, settings);
			saveSettings();

			return interaction.reply({
				content: `Level-up messages will now be posted in ${channel}.`,
				ephemeral: true,
			});
		}

		if (subcommand === 'clearchannel') {
			if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
				return interaction.reply({ content: 'You need Manage Server to configure the level-up channel.', ephemeral: true });
			}

			const settings = levelSettings.get(guildId);
			if (settings) {
				delete settings.levelUpChannelId;
				if (Object.keys(settings).length === 0) {
					levelSettings.delete(guildId);
				} else {
					levelSettings.set(guildId, settings);
				}
				saveSettings();
			}

			return interaction.reply({
				content: 'Level-up messages will now be posted in the channel where the user levels up.',
				ephemeral: true,
			});
		}
	},
};

async function handleLevelMessage(message) {
	if (message.author.bot || !message.guild || !message.member) return;

	const cooldownKey = `${message.guild.id}:${message.author.id}`;
	const now = Date.now();
	const lastXpAt = xpCooldowns.get(cooldownKey) || 0;

	if (now - lastXpAt < XP_COOLDOWN) return;
	xpCooldowns.set(cooldownKey, now);

	const userData = getUserLevelData(message.guild.id, message.author.id);
	userData.xp += getRandomXp();
	userData.messages = (userData.messages || 0) + 1;

	const oldLevel = userData.level;
	while (userData.xp >= getRequiredXp(userData.level)) {
		userData.xp -= getRequiredXp(userData.level);
		userData.level++;
	}

	saveLevels();

	if (userData.level <= oldLevel) return;

	const awardedRoles = await assignLevelRewards(message.member, oldLevel, userData.level);
	const rewardText = awardedRoles.length
		? `\nRole reward${awardedRoles.length === 1 ? '' : 's'}: ${awardedRoles.join(', ')}`
		: '';

	const levelUpChannel = await getLevelUpChannel(message);

	await levelUpChannel.send({
		content: `Level up! ${message.author} reached level **${userData.level}**.${rewardText}`,
	}).catch(() => {});
}

async function getLevelUpChannel(message) {
	const settings = levelSettings.get(message.guild.id);
	if (!settings?.levelUpChannelId) return message.channel;

	const channel = await message.guild.channels.fetch(settings.levelUpChannelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return message.channel;

	return channel;
}

async function assignLevelRewards(member, oldLevel, newLevel) {
	const rewards = levelRewards.get(member.guild.id);
	if (!rewards || rewards.size === 0) return [];

	const awardedRoles = [];
	for (const [level, roleId] of rewards) {
		const rewardLevel = Number(level);
		if (rewardLevel <= oldLevel || rewardLevel > newLevel) continue;

		const role = await member.guild.roles.fetch(roleId).catch(() => null);
		if (!role || member.roles.cache.has(role.id)) continue;

		try {
			await member.roles.add(role, `Level reward for reaching level ${rewardLevel}`);
			awardedRoles.push(role);
		} catch (error) {
			console.error(`Failed to assign level reward ${roleId}:`, error);
		}
	}

	return awardedRoles;
}

module.exports.levelData = levelData;
module.exports.levelRewards = levelRewards;
module.exports.levelSettings = levelSettings;
module.exports.handleLevelMessage = handleLevelMessage;
