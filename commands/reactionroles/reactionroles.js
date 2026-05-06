const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reactionroles')
		.setDescription('Create a reaction role panel where users can select roles')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('The channel to send the reaction role panel to')
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('title')
				.setDescription('The title of the reaction role panel')
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('The description of the reaction role panel')
				.setRequired(true)
		)
		.addRoleOption(option =>
			option
				.setName('role1')
				.setDescription('First role to add to the panel')
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('label1')
				.setDescription('Button label for the first role')
				.setRequired(true)
		)
		.addRoleOption(option =>
			option
				.setName('role2')
				.setDescription('Second role to add to the panel')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('label2')
				.setDescription('Button label for the second role')
				.setRequired(false)
		)
		.addRoleOption(option =>
			option
				.setName('role3')
				.setDescription('Third role to add to the panel')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('label3')
				.setDescription('Button label for the third role')
				.setRequired(false)
		)
		.addRoleOption(option =>
			option
				.setName('role4')
				.setDescription('Fourth role to add to the panel')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('label4')
				.setDescription('Button label for the fourth role')
				.setRequired(false)
		)
		.addRoleOption(option =>
			option
				.setName('role5')
				.setDescription('Fifth role to add to the panel')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('label5')
				.setDescription('Button label for the fifth role')
				.setRequired(false)
		),
	async execute(interaction) {
		// Defer the reply to avoid timeout issues
		await interaction.deferReply({ ephemeral: true });

		const channel = interaction.options.getChannel('channel');
		const title = interaction.options.getString('title');
		const description = interaction.options.getString('description');

		// Collect all role-label pairs
		const roles = [];
		const roleOptions = [
			{ role: interaction.options.getRole('role1'), label: interaction.options.getString('label1') },
			{ role: interaction.options.getRole('role2'), label: interaction.options.getString('label2') },
			{ role: interaction.options.getRole('role3'), label: interaction.options.getString('label3') },
			{ role: interaction.options.getRole('role4'), label: interaction.options.getString('label4') },
			{ role: interaction.options.getRole('role5'), label: interaction.options.getString('label5') },
		];

		for (const { role, label } of roleOptions) {
			if (role && label) {
				roles.push({ role, label });
			}
		}

		if (roles.length === 0) {
			return interaction.editReply({ content: 'You must provide at least one role and label pair.' });
		}

		// Create the embed
		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle(title)
			.setDescription(description)
			.setTimestamp();

		// Add roles to the embed for visibility
		const rolesList = roles.map(r => `${r.label} - ${r.role}`).join('\n');
		embed.addFields({ name: 'Available Roles', value: rolesList });

		// Create buttons for each role
		const buttons = roles.map((r) => {
			return new ButtonBuilder()
				.setCustomId(`reactionrole-${r.role.id}`)
				.setLabel(r.label)
				.setStyle(ButtonStyle.Primary);
		});

		// Split buttons into rows of 5 (Discord limit)
		const rows = [];
		for (let i = 0; i < buttons.length; i += 5) {
			rows.push(
				new ActionRowBuilder()
					.addComponents(...buttons.slice(i, i + 5))
			);
		}

		// Send the panel to the specified channel
		try {
			await channel.send({
				content: '**Select your roles below:**',
				embeds: [embed],
				components: rows
			});

			await interaction.editReply({ content: `Reaction role panel created successfully in ${channel}!` });
		} catch (error) {
			console.error(error);
			await interaction.editReply({ content: 'There was an error creating the reaction role panel. Make sure the bot has permission to send messages in that channel.' });
		}
	}
};