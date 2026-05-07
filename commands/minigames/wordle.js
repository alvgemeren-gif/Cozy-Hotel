const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const activeGames = new Map();
const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

const words = [
	'about',
	'after',
	'apple',
	'beach',
	'bread',
	'brain',
	'chair',
	'charm',
	'clean',
	'cloud',
	'dance',
	'dream',
	'drink',
	'earth',
	'event',
	'floor',
	'fresh',
	'fruit',
	'ghost',
	'glass',
	'grand',
	'green',
	'guest',
	'happy',
	'heart',
	'hotel',
	'house',
	'light',
	'lobby',
	'magic',
	'money',
	'mouse',
	'music',
	'night',
	'party',
	'phone',
	'piano',
	'plant',
	'queen',
	'quiet',
	'river',
	'royal',
	'sleep',
	'smile',
	'sound',
	'story',
	'suite',
	'table',
	'water',
	'world',
	'voice',
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('wordle')
		.setDescription('Start your own Wordle game'),

	async execute(interaction) {
		const userId = interaction.user.id;

		if (activeGames.has(userId)) {
			return interaction.reply({
				content: 'You already have a Wordle game running.',
				ephemeral: true,
			});
		}

		const answer = words[Math.floor(Math.random() * words.length)];
		const game = {
			answer,
			guesses: [],
			startedBy: userId,
		};

		activeGames.set(userId, game);

		await interaction.reply({
			embeds: [buildEmbed(game, `${interaction.user}, guess a 5-letter word in chat.`)],
		});

		const collector = interaction.channel.createMessageCollector({
			filter: message => !message.author.bot && message.author.id === userId,
			time: 10 * 60 * 1000,
		});

		collector.on('collect', async message => {
			const guess = sanitizeWord(message.content);
			if (!guess) return;

			if (game.guesses.some(previousGuess => previousGuess.word === guess)) {
				return message.reply({
					content: `You already guessed **${guess.toUpperCase()}**.`,
				}).then(reply => setTimeout(() => reply.delete().catch(() => {}), 5000));
			}

			game.guesses.push({ word: guess, user: message.author.id });

			if (guess === game.answer) {
				activeGames.delete(userId);
				collector.stop('won');
				return message.channel.send({
					embeds: [buildEmbed(game, `${message.author} solved it in ${game.guesses.length}/${MAX_GUESSES} guesses.`)],
				});
			}

			if (game.guesses.length >= MAX_GUESSES) {
				activeGames.delete(userId);
				collector.stop('lost');
				return message.channel.send({
					embeds: [buildEmbed(game, `Game over. The word was **${game.answer.toUpperCase()}**.`)],
				});
			}

			return message.channel.send({
				embeds: [buildEmbed(game, `${message.author} guessed **${guess.toUpperCase()}**.`)],
			});
		});

		collector.on('end', async (_collected, reason) => {
			if (reason === 'won' || reason === 'lost') return;
			if (!activeGames.has(userId)) return;

			activeGames.delete(userId);
			await interaction.channel.send(`The Wordle game ended. The word was **${answer.toUpperCase()}**.`);
		});
	},
};

function sanitizeWord(word) {
	if (!word) return null;
	const normalized = word.trim().toLowerCase();
	return new RegExp(`^[a-z]{${WORD_LENGTH}}$`).test(normalized) ? normalized : null;
}

function buildEmbed(game, status) {
	const board = renderBoard(game);
	const letters = renderLetterHelp(game);

	return new EmbedBuilder()
		.setColor(isSolved(game) ? 0x2ecc71 : game.guesses.length >= MAX_GUESSES ? 0xe74c3c : 0x3498db)
		.setTitle('Wordle')
		.setDescription(board)
		.addFields(
			{ name: 'Guesses', value: `${game.guesses.length}/${MAX_GUESSES}`, inline: true },
			{ name: 'Letters', value: letters },
			{ name: 'Status', value: status }
		)
		.setFooter({ text: 'Green = correct spot, yellow = wrong spot, gray = not in the word.' })
		.setTimestamp();
}

function renderBoard(game) {
	const rows = game.guesses.map(guess => renderGuess(guess.word, game.answer));

	while (rows.length < MAX_GUESSES) {
		rows.push('⬛⬛⬛⬛⬛');
	}

	return rows.join('\n');
}

function renderGuess(guess, answer) {
	const result = Array(WORD_LENGTH).fill('⬛');
	const remaining = answer.split('');

	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guess[i] === answer[i]) {
			result[i] = '🟩';
			remaining[i] = null;
		}
	}

	for (let i = 0; i < WORD_LENGTH; i++) {
		if (result[i] === '🟩') continue;

		const index = remaining.indexOf(guess[i]);
		if (index !== -1) {
			result[i] = '🟨';
			remaining[index] = null;
		}
	}

	return `${result.join('')}  \`${guess.toUpperCase()}\``;
}

function renderLetterHelp(game) {
	if (game.guesses.length === 0) return 'No letters guessed yet.';

	const bestByLetter = new Map();
	const score = { '⬛': 0, '🟨': 1, '🟩': 2 };

	for (const guess of game.guesses) {
		const result = getGuessResult(guess.word, game.answer);
		for (let i = 0; i < WORD_LENGTH; i++) {
			const letter = guess.word[i].toUpperCase();
			const current = bestByLetter.get(letter);
			if (!current || score[result[i]] > score[current]) {
				bestByLetter.set(letter, result[i]);
			}
		}
	}

	return [...bestByLetter.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([letter, tile]) => `${tile}${letter}`)
		.join(' ');
}

function getGuessResult(guess, answer) {
	const result = Array(WORD_LENGTH).fill('⬛');
	const remaining = answer.split('');

	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guess[i] === answer[i]) {
			result[i] = '🟩';
			remaining[i] = null;
		}
	}

	for (let i = 0; i < WORD_LENGTH; i++) {
		if (result[i] === '🟩') continue;

		const index = remaining.indexOf(guess[i]);
		if (index !== -1) {
			result[i] = '🟨';
			remaining[index] = null;
		}
	}

	return result;
}

function isSolved(game) {
	return game.guesses.some(guess => guess.word === game.answer);
}

module.exports.activeGames = activeGames;
