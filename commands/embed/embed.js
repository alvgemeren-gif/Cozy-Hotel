const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

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
				.setName('title')
				.setDescription('Embed title')
				.setRequired(true)
				.setMaxLength(256)
		)
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('Embed description')
				.setRequired(true)
				.setMaxLength(4000)
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
		const title = interaction.options.getString('title');
		const description = interaction.options.getString('description');
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

		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle(title)
			.setDescription(description)
			.setTimestamp();

		if (image) embed.setImage(image);
		if (thumbnail) embed.setThumbnail(thumbnail);
		if (footer) embed.setFooter({ text: footer });

		await channel.send({ embeds: [embed] });

		return interaction.reply({
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
