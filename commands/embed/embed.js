const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	ChannelType,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('embed')
		.setDescription('Create and send a custom embed')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('The channel where the embed should be sent')
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('image')
				.setDescription('Optional image URL')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('thumbnail')
				.setDescription('Optional thumbnail URL')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('footer')
				.setDescription('Optional footer text')
				.setRequired(false)
				.setMaxLength(2048)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	async execute(interaction) {
		const channel = interaction.options.getChannel('channel');
		const image = interaction.options.getString('image');
		const thumbnail = interaction.options.getString('thumbnail');
		const footer = interaction.options.getString('footer');
		const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

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

		if ((image && !isValidHttpUrl(image)) || (thumbnail && !isValidHttpUrl(thumbnail))) {
			return interaction.reply({
				content: 'Image and thumbnail must be valid `http://` or `https://` URLs.',
				ephemeral: true,
			});
		}

		const modal = new ModalBuilder()
			.setCustomId(`embed-modal-${interaction.id}`)
			.setTitle('Create Embed');

		const titleInput = new TextInputBuilder()
			.setCustomId('embed-title')
			.setLabel('Embed title')
			.setStyle(TextInputStyle.Short)
			.setMaxLength(256)
			.setRequired(true);

		const descriptionInput = new TextInputBuilder()
			.setCustomId('embed-description')
			.setLabel('Embed description')
			.setStyle(TextInputStyle.Paragraph)
			.setMaxLength(4000)
			.setRequired(true);

		modal.addComponents(
			new ActionRowBuilder().addComponents(titleInput),
			new ActionRowBuilder().addComponents(descriptionInput)
		);

		await interaction.showModal(modal);

		const modalInteraction = await interaction.awaitModalSubmit({
			filter: submitted => submitted.customId === `embed-modal-${interaction.id}` && submitted.user.id === interaction.user.id,
			time: 5 * 60 * 1000,
		}).catch(() => null);

		if (!modalInteraction) return;

		const title = modalInteraction.fields.getTextInputValue('embed-title');
		const description = modalInteraction.fields.getTextInputValue('embed-description');

		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle(title)
			.setDescription(description)
			.setTimestamp();

		if (image) embed.setImage(image);
		if (thumbnail) embed.setThumbnail(thumbnail);
		if (footer) embed.setFooter({ text: footer });

		await channel.send({ embeds: [embed] });

		return modalInteraction.reply({
			content: `Embed sent in ${channel}.`,
			ephemeral: true,
		});
	},
};

function isValidHttpUrl(input) {
	try {
		const url = new URL(input);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
