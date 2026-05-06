const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store counting game state per guild
const countingGames = new Map();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('startcounting')
		.setDescription('Start a counting game in this channel')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
	
	async execute(interaction) {
		const guildId = interaction.guild.id;
		const channelId = interaction.channel.id;

		// Check if a game is already running in this guild
		if (countingGames.has(guildId)) {
			const existingGame = countingGames.get(guildId);
			return interaction.reply({
				content: `A counting game is already running in <#${existingGame.channelId}>! Current count: **${existingGame.currentCount}**`,
				ephemeral: true
			});
		}

		// Start a new counting game
		const game = {
			channelId: channelId,
			currentCount: 0,
			lastCounter: null,
			message: null
		};

		countingGames.set(guildId, game);

		// Create an embed to display game info
		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle('🎯 Counting Game Started!')
			.setDescription(
				'**How to play:**\n' +
				'• Users take turns counting up from 1\n' +
				'• Each person can only say the next number\n' +
				'• If someone makes a mistake, the counting continues\n' +
				'• Try to reach high numbers together!\n\n' +
				'**Current Count:** 0\n' +
				'**Next Number:** 1\n\n' +
				'Start counting by saying **1**!'
			)
			.setFooter({ text: `Started by ${interaction.user.tag}` })
			.setTimestamp();

		try {
			const message = await interaction.channel.send({
				content: '🎯 **Counting game has started!** Type the next number to begin!',
				embeds: [embed]
			});

			game.message = message;

			// Set up message collector for this channel
			const filter = m => m.channel.id === channelId && !m.author.bot;
			
			const collector = interaction.channel.createMessageCollector({
				filter,
				time: 0 // No time limit - game runs until stopped
			});

			collector.on('collect', async m => {
				// Ignore if it's not a number
				const number = parseInt(m.content.trim());
				if (isNaN(number)) return;

				// Check if the same person is counting twice in a row
				if (game.lastCounter === m.author.id) {
					await m.delete().catch(() => {});
					const warningEmbed = new EmbedBuilder()
						.setColor(0xFF0000)
						.setDescription(`⚠️ ${m.author}, you can't count twice in a row!`)
						.setTimestamp();
					
					await m.channel.send({ embeds: [warningEmbed] }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
					return;
				}

				const expectedNumber = game.currentCount + 1;

				if (number === expectedNumber) {
					// Correct count!
					game.currentCount = number;
					game.lastCounter = m.author.id;

					// Update the game message
					const updatedEmbed = EmbedBuilder.from(embed.toJSON())
						.setDescription(
							'**How to play:**\n' +
							'• Users take turns counting up from 1\n' +
							'• Each person can only say the next number\n' +
							'• If someone makes a mistake, the counting continues\n' +
							'• Try to reach high numbers together!\n\n' +
							`**Current Count:** ${game.currentCount}\n` +
							`**Next Number:** ${game.currentCount + 1}\n\n` +
							`Last counter: ${m.author}`
						);

					try {
						await game.message.edit({
							content: `🎯 **Counting:** ${game.currentCount}`,
							embeds: [updatedEmbed]
						});
					} catch (error) {
						console.error('Error updating counting message:', error);
					}

					// Celebrate milestones
					if (game.currentCount % 50 === 0 && game.currentCount > 0) {
						const milestoneEmbed = new EmbedBuilder()
							.setColor(0x00FF00)
							.setTitle(`🎉 Milestone Reached! ${game.currentCount}!`)
							.setDescription(`${m.author} helped reach ${game.currentCount}!`)
							.setTimestamp();
						
						await m.channel.send({ embeds: [milestoneEmbed] });
					}

				} else if (number !== expectedNumber) {
					// Wrong number - but we continue counting anyway!
					game.lastCounter = m.author.id;
					
					const mistakeEmbed = new EmbedBuilder()
						.setColor(0xFFA500)
						.setDescription(
							`❌ ${m.author} said **${number}** but the correct number was **${expectedNumber}**!\n` +
							`The counting continues from **${expectedNumber}**!`
						)
						.setTimestamp();

					await m.channel.send({ embeds: [mistakeEmbed] }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
				}
			});

			await interaction.reply({
				content: `Counting game started in <#${channelId}>!`,
				ephemeral: true
			});

		} catch (error) {
			console.error('Error starting counting game:', error);
			countingGames.delete(guildId);
			await interaction.reply({
				content: 'There was an error starting the counting game. Make sure the bot has permission to send messages in this channel.',
				ephemeral: true
			});
		}
	}
};

// Export the counting games map for use in app.js
module.exports.countingGames = countingGames;