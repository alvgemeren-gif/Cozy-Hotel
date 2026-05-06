const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ghostmessage')
		.setDescription('Let the ghost send a message')
		.addStringOption(option =>
			option
				.setName('message')
				.setDescription('The message the ghost should send')
				.setRequired(true)
				.setMaxLength(2000)
		)
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('Where the ghost should send the message')
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
				.setRequired(false)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		const message = interaction.options.getString('message');
		const channel = interaction.options.getChannel('channel') || interaction.channel;

		if (!channel || !channel.isTextBased() || !channel.guild) {
			return interaction.editReply({
				content: 'The ghost can only send messages in server text channels.',
			});
		}

		const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

		if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageWebhooks)) {
			return interaction.editReply({
				content: `I need the Manage Webhooks permission in ${channel} so the ghost can speak.`,
			});
		}

		try {
			const webhook = await channel.createWebhook({
				name: 'Ghost',
				reason: `Ghost message requested by ${interaction.user.tag}`,
			});

			await webhook.send({
				content: message,
				username: 'Ghost',
				avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
				allowedMentions: { parse: ['users', 'roles'] },
			});

			await webhook.delete('Ghost message sent');

			return interaction.editReply({
				content: `The ghost sent your message in ${channel}.`,
			});
		} catch (error) {
			console.error('Error sending ghost message:', error);

			return interaction.editReply({
				content: 'The ghost could not send that message. Please check my channel permissions.',
			});
		}
	},
};
