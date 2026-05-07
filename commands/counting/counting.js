const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const countingGames = new Map();
const CORRECT_EMOJI = '✅';
const WRONG_EMOJI = '❌';
const WARNING_EMOJI = '⚠️';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('startcounting')
		.setDescription('Start a counting game in this channel')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

	async execute(interaction) {
		const guildId = interaction.guild.id;
		const channelId = interaction.channel.id;

		if (countingGames.has(guildId)) {
			const existingGame = countingGames.get(guildId);
			return interaction.reply({
				content: `A counting game is already running in <#${existingGame.channelId}>. Current count: **${existingGame.currentCount}**`,
				ephemeral: true,
			});
		}

		const game = {
			channelId,
			currentCount: 0,
			lastCounter: null,
			message: null,
		};

		countingGames.set(guildId, game);

		const embed = buildCountingEmbed(game, `Started by ${interaction.user.tag}`);

		try {
			const message = await interaction.channel.send({
				content: '**Counting game has started.** Type **1** to begin.',
				embeds: [embed],
			});

			game.message = message;

			const collector = interaction.channel.createMessageCollector({
				filter: messageToCheck => messageToCheck.channel.id === channelId && !messageToCheck.author.bot,
			});

			collector.on('collect', async messageToCheck => {
				const number = parseInt(messageToCheck.content.trim(), 10);
				if (Number.isNaN(number)) return;

				if (game.lastCounter === messageToCheck.author.id) {
					await messageToCheck.react(WARNING_EMOJI).catch(() => {});
					await messageToCheck.delete().catch(() => {});

					const warningEmbed = new EmbedBuilder()
						.setColor(0x9c7453)
						.setDescription(`${WARNING_EMOJI} ${messageToCheck.author}, you cannot count twice in a row.`)
						.setTimestamp();

					await messageToCheck.channel
						.send({ embeds: [warningEmbed] })
						.then(sentMessage => setTimeout(() => sentMessage.delete().catch(() => {}), 5000));
					return;
				}

				const expectedNumber = game.currentCount + 1;

				if (number === expectedNumber) {
					game.currentCount = number;
					game.lastCounter = messageToCheck.author.id;

					await messageToCheck.react(CORRECT_EMOJI).catch(() => {});

					const updatedEmbed = buildCountingEmbed(game, `Last counter: ${messageToCheck.author}`);

					await game.message.edit({
						content: `${CORRECT_EMOJI} **Counting:** ${game.currentCount}`,
						embeds: [updatedEmbed],
					}).catch(error => console.error('Error updating counting message:', error));

					if (game.currentCount % 50 === 0) {
						const milestoneEmbed = new EmbedBuilder()
							.setColor(0x9c7453)
							.setTitle(`Milestone Reached: ${game.currentCount}`)
							.setDescription(`${messageToCheck.author} helped reach ${game.currentCount}.`)
							.setTimestamp();

						await messageToCheck.channel.send({ embeds: [milestoneEmbed] });
					}

					return;
				}

				game.lastCounter = messageToCheck.author.id;

				await messageToCheck.react(WRONG_EMOJI).catch(() => {});

				const mistakeEmbed = new EmbedBuilder()
					.setColor(0x9c7453)
					.setDescription(
						`${WRONG_EMOJI} ${messageToCheck.author} said **${number}**, but the correct number was **${expectedNumber}**.\n` +
						`The counting continues from **${expectedNumber}**.`
					)
					.setTimestamp();

				await messageToCheck.channel
					.send({ embeds: [mistakeEmbed] })
					.then(sentMessage => setTimeout(() => sentMessage.delete().catch(() => {}), 10000));
			});

			return interaction.reply({
				content: `Counting game started in <#${channelId}>.`,
				ephemeral: true,
			});
		} catch (error) {
			console.error('Error starting counting game:', error);
			countingGames.delete(guildId);

			return interaction.reply({
				content: 'There was an error starting the counting game. Make sure I can send messages in this channel.',
				ephemeral: true,
			});
		}
	},
};

function buildCountingEmbed(game, footerText) {
	return new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Counting Game')
		.setDescription(
			'**How to play:**\n' +
			'- Users take turns counting up from 1.\n' +
			'- Each person can only say the next number.\n' +
			'- If someone makes a mistake, the counting continues.\n' +
			'- Try to reach high numbers together.\n\n' +
			`**Current Count:** ${game.currentCount}\n` +
			`**Next Number:** ${game.currentCount + 1}`
		)
		.setFooter({ text: footerText })
		.setTimestamp();
}

module.exports.countingGames = countingGames;
