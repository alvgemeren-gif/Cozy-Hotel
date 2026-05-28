const {
	ActionRowBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	RoleSelectMenuBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
} = require('discord.js');

const COMMAND_NAME = 'keuzerollen';
const SETUP_MENU_ID = `${COMMAND_NAME}:setup`;
const PICK_MENU_ID = `${COMMAND_NAME}:pick`;
const EMBED_COLOR = 0x0b1f3a;
const pendingSetups = new Map();

module.exports = {
	data: new SlashCommandBuilder()
		.setName(COMMAND_NAME)
		.setDescription('Maak een keuzerollen-menu voor leden.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
		.addStringOption(option =>
			option
				.setName('titel')
				.setDescription('Titel van het keuzerollen bericht.')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('tekst')
				.setDescription('Tekst boven de keuzerollen.')
				.setRequired(false)
		),

	async execute(interaction) {
		const title = interaction.options.getString('titel') || 'Keuzerollen';
		const description = interaction.options.getString('tekst')
			|| 'Kies hieronder welke rollen je wilt hebben. Je kunt je keuze later opnieuw aanpassen.';

		const roleSelect = new RoleSelectMenuBuilder()
			.setCustomId(SETUP_MENU_ID)
			.setPlaceholder('Selecteer de rollen die leden mogen kiezen')
			.setMinValues(1)
			.setMaxValues(25);

		const setupMessage = await interaction.reply({
			content: 'Klik hieronder alle rollen aan die je beschikbaar wilt maken als keuzerollen.',
			components: [new ActionRowBuilder().addComponents(roleSelect)],
			ephemeral: true,
			fetchReply: true,
		});

		pendingSetups.set(setupMessage.id, {
			title,
			description,
		});
	},

	async handleSelectMenu(interaction) {
		if (interaction.customId.startsWith(SETUP_MENU_ID)) {
			await handleSetupMenu(interaction);
			return;
		}

		if (interaction.customId === PICK_MENU_ID) {
			await handlePickMenu(interaction);
		}
	},
};

async function handleSetupMenu(interaction) {
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
		await interaction.reply({
			content: 'Je hebt de permissie Rollen beheren nodig om keuzerollen te maken.',
			ephemeral: true,
		});
		return;
	}

	const setup = pendingSetups.get(interaction.message.id) || {};
	const title = setup.title || 'Keuzerollen';
	const description = setup.description || 'Kies hieronder je rollen.';
	const selectedRoleIds = interaction.values;

	const options = selectedRoleIds
		.map(roleId => interaction.guild.roles.cache.get(roleId))
		.filter(Boolean)
		.map(role => ({
			label: role.name.slice(0, 100),
			value: role.id,
			description: `Kies de rol ${role.name}`.slice(0, 100),
		}));

	if (!options.length) {
		await interaction.update({
			content: 'Ik kon geen geldige rollen vinden. Probeer het opnieuw.',
			components: [],
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setColor(EMBED_COLOR)
		.setTitle(title)
		.setDescription(description);

	const rolePicker = new StringSelectMenuBuilder()
		.setCustomId(PICK_MENU_ID)
		.setPlaceholder('Kies je rollen')
		.setMinValues(0)
		.setMaxValues(options.length)
		.addOptions(options);

	await interaction.channel.send({
		embeds: [embed],
		components: [new ActionRowBuilder().addComponents(rolePicker)],
	});

	await interaction.update({
		content: 'Het keuzerollen-menu is geplaatst.',
		components: [],
	});

	pendingSetups.delete(interaction.message.id);
}

async function handlePickMenu(interaction) {
	const selectedRoleIds = new Set(interaction.values);
	const availableRoleIds = interaction.component.options.map(option => option.value);
	const member = await interaction.guild.members.fetch(interaction.user.id);

	const rolesToAdd = availableRoleIds.filter(roleId =>
		selectedRoleIds.has(roleId) && !member.roles.cache.has(roleId)
	);
	const rolesToRemove = availableRoleIds.filter(roleId =>
		!selectedRoleIds.has(roleId) && member.roles.cache.has(roleId)
	);

	if (rolesToAdd.length) {
		await member.roles.add(rolesToAdd);
	}

	if (rolesToRemove.length) {
		await member.roles.remove(rolesToRemove);
	}

	await interaction.reply({
		content: 'Je keuzerollen zijn bijgewerkt.',
		ephemeral: true,
	});
}
