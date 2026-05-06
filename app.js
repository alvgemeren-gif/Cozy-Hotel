require('dotenv').config(); //This will be used to store private keys
const path = require('path');
const fs = require('fs');
const http = require('http');
const deployCommands = require('./deploy/deployCommands');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const getMeme = require('./commands/getMeme/getMeme');

// Store counting game state per guild
const countingGames = new Map();

// Store minigame state per user
const minigames = new Map();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('Bot is running');
}).listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

const BOT_TOKEN = process.env.CLIENT_TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);


for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Register our commands
deployCommands();


client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Handle counting game messages
client.on(Events.MessageCreate, async message => {
	// Ignore bot messages
	if (message.author.bot) return;

	const guildId = message.guild?.id;
	if (!guildId) return;

	// Check if there's an active counting game in this guild
	if (!countingGames.has(guildId)) return;

	const game = countingGames.get(guildId);
	
	// Check if the message is in the counting channel
	if (message.channel.id !== game.channelId) return;

	// Ignore if it's not a number
	const number = parseInt(message.content.trim());
	if (isNaN(number)) return;

	// Check if the same person is counting twice in a row
	if (game.lastCounter === message.author.id) {
		await message.delete().catch(() => {});
		const { EmbedBuilder } = require('discord.js');
		const warningEmbed = new EmbedBuilder()
			.setColor(0xFF0000)
			.setDescription(`⚠️ ${message.author}, you can't count twice in a row!`)
			.setTimestamp();
		
		const warnMsg = await message.channel.send({ embeds: [warningEmbed] });
		setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
		return;
	}

	const expectedNumber = game.currentCount + 1;

	if (number === expectedNumber) {
		// Correct count!
		game.currentCount = number;
		game.lastCounter = message.author.id;

		// Add a checkmark emoji to the user's message
		await message.react('✅');

		// Update the game message
		const { EmbedBuilder } = require('discord.js');
		const updatedEmbed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle('🎯 Counting Game')
			.setDescription(
				'**How to play:**\n' +
				'• Users take turns counting up from 1\n' +
				'• Each person can only say the next number\n' +
				'• If someone makes a mistake, the counting continues\n' +
				'• Try to reach high numbers together!\n\n' +
				`**Current Count:** ${game.currentCount}\n` +
				`**Next Number:** ${game.currentCount + 1}\n\n` +
				`Last counter: ${message.author}`
			)
			.setTimestamp();

		try {
			if (game.message) {
				await game.message.edit({
					content: `🎯 **Counting:** ${game.currentCount}`,
					embeds: [updatedEmbed]
				});
			}
		} catch (error) {
			console.error('Error updating counting message:', error);
		}

		// Celebrate milestones
		if (game.currentCount % 50 === 0 && game.currentCount > 0) {
			const milestoneEmbed = new EmbedBuilder()
				.setColor(0x00FF00)
				.setTitle(`🎉 Milestone Reached! ${game.currentCount}!`)
				.setDescription(`${message.author} helped reach ${game.currentCount}!`)
				.setTimestamp();
			
			await message.channel.send({ embeds: [milestoneEmbed] });
		}

	} else if (number !== expectedNumber) {
		// Wrong number - but we continue counting anyway!
		game.lastCounter = message.author.id;
		
		// Add a cross emoji to indicate mistake
		await message.react('❌');
		
		const { EmbedBuilder } = require('discord.js');
		const mistakeEmbed = new EmbedBuilder()
			.setColor(0xFFA500)
			.setDescription(
				`❌ ${message.author} said **${number}** but the correct number was **${expectedNumber}**!\n` +
				`The counting continues from **${expectedNumber}**!`
			)
			.setTimestamp();

		const errorMsg = await message.channel.send({ embeds: [mistakeEmbed] });
		setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
	}
});

	client.on(Events.InteractionCreate, async interaction => {
		// Handle modal submissions for reviews
		if (interaction.isModalSubmit()) {
			if (interaction.customId.startsWith('review-modal-')) {
				const reviewType = interaction.customId.replace('review-modal-', '');
				
				try {
					let reviewData = {};
					let reviewTitle = '';
					let reviewDescription = '';
					
					if (reviewType === 'books') {
						reviewData = {
							title: interaction.fields.getTextInputValue('book-title'),
							author: interaction.fields.getTextInputValue('book-author'),
							stars: interaction.fields.getTextInputValue('book-stars')
						};
						reviewTitle = `📚 Book Review: ${reviewData.title}`;
						reviewDescription = `**Author:** ${reviewData.author}\n**Rating:** ${'⭐'.repeat(reviewData.stars)}${'☆'.repeat(5 - reviewData.stars)} (${reviewData.stars}/5)`;
					} else if (reviewType === 'recipes') {
						reviewData = {
							title: interaction.fields.getTextInputValue('recipe-title'),
							link: interaction.fields.getTextInputValue('recipe-link'),
							stars: interaction.fields.getTextInputValue('recipe-stars'),
							categories: interaction.fields.getTextInputValue('recipe-categories')
						};
						reviewTitle = `🍳 Recipe Review: ${reviewData.title}`;
						reviewDescription = `**Link:** ${reviewData.link}\n**Categories:** ${reviewData.categories}\n**Rating:** ${'⭐'.repeat(reviewData.stars)}${'☆'.repeat(5 - reviewData.stars)} (${reviewData.stars}/5)`;
					} else if (reviewType === 'drinks') {
						reviewData = {
							title: interaction.fields.getTextInputValue('drink-title'),
							link: interaction.fields.getTextInputValue('drink-link'),
							stars: interaction.fields.getTextInputValue('drink-stars'),
							categories: interaction.fields.getTextInputValue('drink-categories')
						};
						reviewTitle = `🍹 Drink Review: ${reviewData.title}`;
						reviewDescription = `**Link:** ${reviewData.link}\n**Categories:** ${reviewData.categories}\n**Rating:** ${'⭐'.repeat(reviewData.stars)}${'☆'.repeat(5 - reviewData.stars)} (${reviewData.stars}/5)`;
					}
					
					// Send the review to the channel where the command was used
					await interaction.channel.send({
						content: `**${reviewTitle}**\n${reviewDescription}\n*Reviewed by ${interaction.user}*`
					});
					
					await interaction.reply({ content: 'Your review has been submitted successfully!', ephemeral: true });
				} catch (error) {
					console.error(error);
					await interaction.reply({ content: 'There was an error submitting your review.', ephemeral: true });
				}
				return;
			}
		}

		// Handle button interactions for reaction roles
		if (interaction.isButton()) {
			if (interaction.customId.startsWith('reactionrole-')) {
				const roleId = interaction.customId.replace('reactionrole-', '');
				const member = interaction.member;
				const guild = interaction.guild;

				try {
					const role = await guild.roles.fetch(roleId);
					if (!role) {
						return interaction.reply({ content: 'This role no longer exists.', ephemeral: true });
					}

					if (member.roles.cache.has(roleId)) {
						// Remove the role
						await member.roles.remove(role);
						await interaction.reply({ content: `Removed the ${role.name} role from your profile.`, ephemeral: true });
					} else {
						// Add the role
						await member.roles.add(role);
						await interaction.reply({ content: `Added the ${role.name} role to your profile!`, ephemeral: true });
					}
				} catch (error) {
					console.error(error);
					await interaction.reply({ content: 'There was an error managing your roles. Make sure the bot has permission to manage roles.', ephemeral: true });
				}
				return;
			}
		}

		// Handle string select menu interactions for reviews
		if (interaction.isStringSelectMenu()) {
			// This is handled by the review command itself, so we just ignore it here
			// The review command sets up its own collector
			return;
		}

		// Handle button interactions for minigames
		if (interaction.isButton()) {
			// Wordle guess button
			if (interaction.customId.startsWith('wordle-guess-')) {
				// This is handled by the wordle command itself via collector
				return;
			}

			// Minesweeper buttons
			if (interaction.customId.startsWith('mine-')) {
				const userId = interaction.user.id;
				const game = minigames.get(`minesweeper-${userId}`);
				if (!game || game.status !== 'active') {
					return interaction.reply({ content: 'No active Minesweeper game found. Use /minigames minesweeper to start a new game.', ephemeral: true });
				}

				const parts = interaction.customId.split('-');
				const r = parseInt(parts[1]);
				const c = parseInt(parts[2]);
				const key = `${r}-${c}`;

				if (game.revealed.has(key) || game.flagged.has(key)) {
					return interaction.reply({ content: 'This cell is already revealed or flagged!', ephemeral: true });
				}

				const cell = game.grid[r][c];

				if (cell.isMine) {
					// Hit a mine - game over
					game.status = 'lost';
					game.revealed.add(key);

					// Reveal all mines
					for (let mr = 0; mr < game.rows; mr++) {
						for (let mc = 0; mc < game.cols; mc++) {
							if (game.grid[mr][mc].isMine) {
								game.revealed.add(`${mr}-${mc}`);
							}
						}
					}

					const embed = createMinesweeperEmbed(game);
					const components = createMinesweeperButtons(game);

					return interaction.update({
						content: '💥 **BOOM!** You hit a mine! Game over!',
						embeds: [embed],
						components: components
					});
				}

				// Reveal the cell
				game.revealed.add(key);

				// Check if won (all non-mine cells revealed)
				const totalSafe = game.rows * game.cols - game.mineCount;
				if (game.revealed.size === totalSafe) {
					game.status = 'won';
				}

				const embed = createMinesweeperEmbed(game);
				const components = createMinesweeperButtons(game);

				await interaction.update({
					content: '💣 **Minesweeper** - Keep going!',
					embeds: [embed],
					components: components
				});
				return;
			}

			// Minesweeper mode toggle
			if (interaction.customId === 'mine-mode-toggle') {
				return interaction.reply({ content: 'Flag mode toggled! (Feature coming soon)', ephemeral: true });
			}

			// Galgje (Hangman) letter buttons
			if (interaction.customId.startsWith('galgje-')) {
				const userId = interaction.user.id;
				const game = minigames.get(`galgje-${userId}`);
				if (!game || game.status !== 'active') {
					return interaction.reply({ content: 'No active Galgje game found. Use /minigames galgje to start a new game.', ephemeral: true });
				}

				const letter = interaction.customId.replace('galgje-', '');

				if (game.guessedLetters.has(letter)) {
					return interaction.reply({ content: 'You already guessed that letter!', ephemeral: true });
				}

				game.guessedLetters.add(letter);

				// Check if letter is in the word
				if (!game.targetWord.includes(letter)) {
					game.wrongGuesses++;
				}

				// Check win condition
				let won = true;
				for (const char of game.targetWord) {
					if (!game.guessedLetters.has(char)) {
						won = false;
						break;
					}
				}

				if (won) {
					game.status = 'won';
				} else if (game.wrongGuesses >= game.maxWrongGuesses) {
					game.status = 'lost';
				}

				const embed = createGalgjeEmbed(game);
				const components = createGalgjeButtons(game);

				await interaction.update({
					content: game.status === 'won' ? '🎉 You won!' : game.status === 'lost' ? '😔 Game over!' : '🎭 **Galgje** - Keep guessing!',
					embeds: [embed],
					components: components
				});
				return;
			}
		}

		// Handle modal submissions for minigames
		if (interaction.isModalSubmit()) {
			// Wordle modal
			if (interaction.customId.startsWith('wordle-modal-')) {
				const userId = interaction.customId.replace('wordle-modal-', '');
				const game = minigames.get(`wordle-${userId}`);
				if (!game || game.status !== 'active') {
					return interaction.reply({ content: 'No active Wordle game found. Use /minigames wordle to start a new game.', ephemeral: true });
				}

				const guess = interaction.fields.getTextInputValue('wordle-guess-input').toLowerCase();

				// Validate guess
				if (guess.length !== 5) {
					return interaction.reply({ content: 'The word must be 5 letters long!', ephemeral: true });
				}

				if (!wordleWords.includes(guess)) {
					return interaction.reply({ content: 'That word is not in the word list! Try another 5-letter word.', ephemeral: true });
				}

				// Evaluate guess
				const result = evaluateWordleGuess(guess, game.targetWord);
				game.guesses.push({ word: guess, result: result });

				// Check win condition
				if (result === '🟩🟩🟩🟩🟩') {
					game.status = 'won';
				} else if (game.guesses.length >= game.maxGuesses) {
					game.status = 'lost';
				}

				const embed = createWordleEmbed(game);

				// If game is over, remove the button
				const components = game.status === 'active' ? [
					new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId(`wordle-guess-${userId}`)
								.setLabel('Make a Guess')
								.setStyle(ButtonStyle.Primary)
						)
				] : [];

				await interaction.update({
					content: game.status === 'won' ? '🎉 You won!' : game.status === 'lost' ? '😔 Game over!' : '🟩🟨⬛ **Wordle** - Keep guessing!',
					embeds: [embed],
					components: components
				});
				return;
			}
		}

		// Handle chat input commands
	    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.login(BOT_TOKEN);