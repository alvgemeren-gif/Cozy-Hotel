const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const activeGames = new Map();

const words = [
	'about',
	'after',
	'alert',
	'beach',
	'brain',
	'chair',
	'charm',
	'dance',
	'drink',
	'event',
	'floor',
	'ghost',
	'grand',
	'guest',
	'hotel',
	'house',
	'lobby',
	'magic',
	'music',
	'night',
	'party',
	'piano',
	'queen',
	'river',
	'royal',
	'smile',
	'story',
	'suite',
	'table',
	'voice',
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('wordle')
		.setDescription('Start a Wordle game in this channel')
		.addStringOption(option =>
			option
				.setName('word')
				.setDescription('Optional custom 5-letter word')
				.setRequired(false)
				.setMinLength(5)
				.setMaxLength(5)
		),

	async execute(interaction) {
		const channelId = interaction.channel.id;

		if (activeGames.has(channelId)) {
			return interaction.reply({
				content: 'A Wordle game is already running in this channel.',
				ephemeral: true,
			});
		}

		const customWord = sanitizeWord(interaction.options.getString('word'));
		const answer = customWord || words[Math.floor(Math.random() * words.length)];
		const game = {
			answer,
			guesses: [],
			startedBy: interaction.user.id,
		};

		activeGames.set(channelId, game);

		await interaction.reply({
			embeds: [buildEmbed(game, `Game started by ${interaction.user}. Guess a 5-letter word in chat.`)],
		});

		const collector = interaction.channel.createMessageCollector({
			filter: message => !message.author.bot,
			time: 10 * 60 * 1000,
		});

		collector.on('collect', async message => {
			const guess = sanitizeWord(message.content);
			if (!guess) return;

			game.guesses.push({ word: guess, user: message.author.id });

			if (guess === game.answer) {
				activeGames.delete(channelId);
				collector.stop('won');
				return message.channel.send({
					embeds: [buildEmbed(game, `${message.author} solved it in ${game.guesses.length}/6 guesses.`)],
				});
			}

			if (game.guesses.length >= 6) {
				activeGames.delete(channelId);
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
			if (!activeGames.has(channelId)) return;

			activeGames.delete(channelId);
			await interaction.channel.send(`The Wordle game ended. The word was **${answer.toUpperCase()}**.`);
		});
	},
};

function sanitizeWord(word) {
	if (!word) return null;
	const normalized = word.trim().toLowerCase();
	return /^[a-z]{5}$/.test(normalized) ? normalized : null;
}

function buildEmbed(game, status) {
	const board = game.guesses.length
		? game.guesses.map(guess => renderGuess(guess.word, game.answer)).join('\n')
		: '```\n_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ _\n_ _ _ _ _\n```';

	return new EmbedBuilder()
		.setColor(isSolved(game) ? 0x2ecc71 : game.guesses.length >= 6 ? 0xe74c3c : 0x3498db)
		.setTitle('Wordle')
		.setDescription(board)
		.addFields(
			{ name: 'Guesses', value: `${game.guesses.length}/6`, inline: true },
			{ name: 'Status', value: status }
		)
		.setFooter({ text: 'G = correct spot, Y = wrong spot, X = not in the word.' })
		.setTimestamp();
}

function renderGuess(guess, answer) {
	const result = Array(5).fill('X');
	const remaining = answer.split('');

	for (let i = 0; i < 5; i++) {
		if (guess[i] === answer[i]) {
			result[i] = 'G';
			remaining[i] = null;
		}
	}

	for (let i = 0; i < 5; i++) {
		if (result[i] === 'G') continue;

		const index = remaining.indexOf(guess[i]);
		if (index !== -1) {
			result[i] = 'Y';
			remaining[index] = null;
		}
	}

	return `\`${guess.toUpperCase()} | ${result.join(' ')}\``;
}

function isSolved(game) {
	return game.guesses.some(guess => guess.word === game.answer);
}

module.exports.activeGames = activeGames;
