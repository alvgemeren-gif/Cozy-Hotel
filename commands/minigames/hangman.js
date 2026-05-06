const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const activeGames = new Map();

const words = [
	'hotel',
	'ghost',
	'storyline',
	'mystery',
	'lobby',
	'reservation',
	'diamond',
	'kitchen',
	'elevator',
	'manager',
	'concierge',
	'ballroom',
	'suite',
	'keycard',
	'basement',
];

const stages = [
	'```\n +---+\n |   |\n     |\n     |\n     |\n     |\n=======\n```',
	'```\n +---+\n |   |\n O   |\n     |\n     |\n     |\n=======\n```',
	'```\n +---+\n |   |\n O   |\n |   |\n     |\n     |\n=======\n```',
	'```\n +---+\n |   |\n O   |\n/|   |\n     |\n     |\n=======\n```',
	'```\n +---+\n |   |\n O   |\n/|\\  |\n     |\n     |\n=======\n```',
	'```\n +---+\n |   |\n O   |\n/|\\  |\n/    |\n     |\n=======\n```',
	'```\n +---+\n |   |\n O   |\n/|\\  |\n/ \\  |\n     |\n=======\n```',
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hangman')
		.setDescription('Start a game of hangman in this channel')
		.addStringOption(option =>
			option
				.setName('word')
				.setDescription('Optional custom word for this game')
				.setRequired(false)
				.setMinLength(3)
				.setMaxLength(24)
		),

	async execute(interaction) {
		const channelId = interaction.channel.id;

		if (activeGames.has(channelId)) {
			return interaction.reply({
				content: 'A hangman game is already running in this channel.',
				ephemeral: true,
			});
		}

		const customWord = interaction.options.getString('word');
		const word = sanitizeWord(customWord) || words[Math.floor(Math.random() * words.length)];
		const game = {
			word,
			guessed: new Set(),
			wrong: new Set(),
			startedBy: interaction.user.id,
		};

		activeGames.set(channelId, game);

		await interaction.reply({
			embeds: [buildEmbed(game, `Game started by ${interaction.user}. Guess a letter or the full word in chat.`)],
		});

		const collector = interaction.channel.createMessageCollector({
			filter: message => !message.author.bot,
			time: 10 * 60 * 1000,
		});

		collector.on('collect', async message => {
			const guess = sanitizeGuess(message.content);
			if (!guess) return;

			const result = handleGuess(game, guess);
			if (!result.changed) return;

			if (result.won) {
				activeGames.delete(channelId);
				collector.stop('won');
				return message.channel.send({
					embeds: [buildEmbed(game, `${message.author} solved it. The word was **${game.word}**.`)],
				});
			}

			if (result.lost) {
				activeGames.delete(channelId);
				collector.stop('lost');
				return message.channel.send({
					embeds: [buildEmbed(game, `Game over. The word was **${game.word}**.`)],
				});
			}

			return message.channel.send({
				embeds: [buildEmbed(game, result.correct ? `${message.author} guessed correctly.` : `${message.author} guessed wrong.`)],
			});
		});

		collector.on('end', async (_collected, reason) => {
			if (reason === 'won' || reason === 'lost') return;
			if (!activeGames.has(channelId)) return;

			activeGames.delete(channelId);
			await interaction.channel.send('The hangman game ended because nobody guessed for 10 minutes.');
		});
	},
};

function sanitizeWord(word) {
	if (!word) return null;
	const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
	return normalized.length >= 3 ? normalized : null;
}

function sanitizeGuess(content) {
	const guess = content.trim().toLowerCase();
	if (!/^[a-z]+$/.test(guess)) return null;
	return guess;
}

function handleGuess(game, guess) {
	if (guess.length === 1) {
		if (game.guessed.has(guess) || game.wrong.has(guess)) {
			return { changed: false };
		}

		if (game.word.includes(guess)) {
			game.guessed.add(guess);
			return { changed: true, correct: true, won: isWon(game), lost: false };
		}

		game.wrong.add(guess);
		return { changed: true, correct: false, won: false, lost: game.wrong.size >= stages.length - 1 };
	}

	if (guess === game.word) {
		for (const letter of game.word) {
			game.guessed.add(letter);
		}
		return { changed: true, correct: true, won: true, lost: false };
	}

	game.wrong.add(guess);
	return { changed: true, correct: false, won: false, lost: game.wrong.size >= stages.length - 1 };
}

function isWon(game) {
	return [...game.word].every(letter => game.guessed.has(letter));
}

function buildEmbed(game, status) {
	const hiddenWord = [...game.word]
		.map(letter => game.guessed.has(letter) ? letter.toUpperCase() : '_')
		.join(' ');
	const wrongGuesses = [...game.wrong].join(', ') || 'None';
	const stage = stages[Math.min(game.wrong.size, stages.length - 1)];

	return new EmbedBuilder()
		.setColor(game.wrong.size >= stages.length - 1 ? 0xe74c3c : isWon(game) ? 0x2ecc71 : 0x3498db)
		.setTitle('Hangman')
		.setDescription(`${stage}\n**Word:** ${hiddenWord}\n**Wrong guesses:** ${wrongGuesses}`)
		.addFields({ name: 'Status', value: status })
		.setFooter({ text: 'Guess one letter or the full word.' })
		.setTimestamp();
}

module.exports.activeGames = activeGames;
