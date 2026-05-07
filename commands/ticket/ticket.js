const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	PermissionFlagsBits,
	ChannelType,
} = require('discord.js');

const ticketSettings = new Map();

const ticketTypes = [
	{
		label: 'Application',
		description: 'Apply for a staff position',
		value: 'application',
	},
	{
		label: 'Partnership',
		description: 'Propose a partnership',
		value: 'partnership',
	},
	{
		label: 'Question',
		description: 'Ask a general question',
		value: 'question',
	},
	{
		label: 'Complaint',
		description: 'Submit a complaint',
		value: 'complaint',
	},
	{
		label: 'Storyline',
		description: 'Submit a storyline request or idea',
		value: 'storyline',
	},
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ticketpanel')
		.setDescription('Create a ticket support panel')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('The channel where the ticket panel will be sent')
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('title')
				.setDescription('Title for the ticket panel')
				.setRequired(false)
				.setMaxLength(256)
		)
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('Description for the ticket panel')
				.setRequired(false)
				.setMaxLength(1000)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

	async execute(interaction) {
		const channel = interaction.options.getChannel('channel');
		const customTitle = interaction.options.getString('title') || 'Support Panel';
		const customDescription = interaction.options.getString('description')
			|| 'Select the type of support you need below. Our team will respond to your ticket as soon as possible.';
		const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

		if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
			return interaction.reply({
				content: 'I need the Manage Channels permission to create ticket channels.',
				ephemeral: true,
			});
		}

		if (!channel.permissionsFor(botMember).has([
			PermissionFlagsBits.ViewChannel,
			PermissionFlagsBits.SendMessages,
			PermissionFlagsBits.EmbedLinks,
		])) {
			return interaction.reply({
				content: `I need View Channel, Send Messages, and Embed Links permissions in ${channel}.`,
				ephemeral: true,
			});
		}

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('ticket-type')
			.setPlaceholder('Select the type of ticket...')
			.addOptions(ticketTypes);

		const row = new ActionRowBuilder().addComponents(selectMenu);
		const typeList = ticketTypes
			.map(type => `**${type.label}** - ${type.description}`)
			.join('\n');

		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle(customTitle)
			.setDescription(customDescription)
			.addFields({
				name: 'Ticket Types',
				value: `${typeList}\n\nSelect the ticket type that best fits your situation above.`,
			})
			.setFooter({ text: 'Cozy Hotel Support Team' })
			.setTimestamp();

		await channel.send({
			content: '**Support Panel** - Select the type of ticket below:',
			embeds: [embed],
			components: [row],
		});

		return interaction.reply({
			content: `Ticket panel sent in ${channel}.`,
			ephemeral: true,
		});
	},
};

module.exports.ticketSettings = ticketSettings;
