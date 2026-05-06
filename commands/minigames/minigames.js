const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Game state storage - this will be shared with app.js
const activeGames = global.minigames || new Map();

// Make it globally accessible
if (!global.minigames) {
    global.minigames = activeGames;
}

// Word lists for Wordle (5-letter words)
const wordleWords = [
	'apple', 'beach', 'brain', 'bread', 'brush', 'chair', 'chest', 'cloud', 
	'coach', 'coast', 'court', 'cover', 'cream', 'crime', 'cross', 'crowd', 
	'crown', 'curve', 'cycle', 'dance', 'death', 'depth', 'doubt', 'draft', 
	'drama', 'dream', 'dress', 'drink', 'drive', 'earth', 'enemy', 'entry', 
	'error', 'event', 'faith', 'fault', 'field', 'fight', 'final', 'floor', 
	'focus', 'force', 'frame', 'frank', 'front', 'fruit', 'glass', 'grant', 
	'grass', 'green', 'group', 'guide', 'heart', 'henry', 'horse', 'house', 
	'human', 'ideal', 'image', 'index', 'input', 'issue', 'judge', 'knife', 
	'layer', 'level', 'light', 'limit', 'lunch', 'major', 'march', 'match', 
	'metal', 'model', 'money', 'month', 'motor', 'mouth', 'music', 'night', 
	'noise', 'north', 'novel', 'nurse', 'offer', 'order', 'other', 'owner', 
	'panel', 'paper', 'party', 'peace', 'phase', 'phone', 'photo', 'piece', 
	'pilot', 'pitch', 'place', 'plane', 'plant', 'plate', 'point', 'pound', 
	'power', 'press', 'price', 'pride', 'prime', 'print', 'proof', 'queen', 
	'radio', 'range', 'ratio', 'reply', 'right', 'river', 'round', 'route', 
	'rugby', 'scale', 'scene', 'scope', 'score', 'sense', 'shape', 'share', 
	'shock', 'sight', 'simon', 'skill', 'sleep', 'smile', 'smith', 'smoke', 
	'sound', 'south', 'space', 'speed', 'spite', 'sport', 'squad', 'staff', 
	'stage', 'start', 'state', 'steam', 'steel', 'stock', 'stone', 'store', 
	'study', 'stuff', 'style', 'sugar', 'table', 'taste', 'terry', 'theme', 
	'thing', 'title', 'total', 'touch', 'tower', 'track', 'trade', 'train', 
	'trend', 'trial', 'truck', 'trust', 'truth', 'uncle', 'union', 'unity', 
	'value', 'video', 'visit', 'voice', 'waste', 'watch', 'water', 'while', 
	'white', 'whole', 'woman', 'world', 'youth'
];

// Word lists for Galgje (Dutch words)
const galgjeWords = [
	'appel', 'boom', 'huis', 'auto', 'boek', 'deur', 'fiets', 'goud', 
	'hand', 'ijs', 'jas', 'kaas', 'lamp', 'maAN', 'neus', 'oog', 'paard', 
	'roos', 'stoel', 'tafel', 'uur', 'vis', 'wiel', 'zon', 'brood', 'kleur',
	'school', 'leraar', 'leerling', 'taan', 'water', 'lucht', 'aarde', 'vuur',
	'bloem', 'vogel', 'hond', 'kat', 'vis', 'paard', 'koe', 'schaap', 'varken',
	'kip', 'eend', 'gans', 'duif', 'mus', 'leeuw', 'tijger', 'beer', 'wolf',
	'vos', 'hert', 'konijn', 'muis', 'rat', 'slang', 'haai', 'walvis', 'dolfijn'
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('minigames')
		.setDescription('Play a mini-game!')
		.addSubcommand(subcommand =>
			subcommand
				.setName('wordle')
				.setDescription('Play Wordle! Guess the 5-letter word in 6 tries.')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('minesweeper')
				.setDescription('Play Minesweeper! Reveal cells without hitting mines.')
				.addIntegerOption(option =>
					option
						.setName('difficulty')
						.setDescription('Game difficulty (1=easy, 2=medium, 3=hard)')
						.setMinValue(1)
						.setMaxValue(3)
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('galgje')
				.setDescription('Play Galgje (Hangman)! Guess the word before the stick figure is complete.')
		),
	
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		
		if (subcommand === 'wordle') {
			await startWordle(interaction);
		} else if (subcommand === 'minesweeper') {
			await startMinesweeper(interaction);
		} else if (subcommand === 'galgje') {
			await startGalgje(interaction);
		}
	}
};

// Wordle Game
async function startWordle(interaction) {
	const userId = interaction.user.id;
	
	// Check if user already has an active game
	if (activeGames.has(`wordle-${userId}`)) {
		return interaction.reply({
			content: 'You already have an active Wordle game! Finish it first or wait for it to expire.',
			ephemeral: true
		});
	}
	
	// Pick a random word
	const targetWord = wordleWords[Math.floor(Math.random() * wordleWords.length)];
	
	// Game state
	const game = {
		type: 'wordle',
		targetWord: targetWord,
		guesses: [],
		maxGuesses: 6,
		status: 'active'
	};
	
	activeGames.set(`wordle-${userId}`, game);
	
	// Create initial embed
	const embed = createWordleEmbed(game);
	
	// Create input row (we'll use a modal for guesses)
	const row = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId(`wordle-guess-${userId}`)
				.setLabel('Make a Guess')
				.setStyle(ButtonStyle.Primary)
		);
	
	const response = await interaction.reply({
		content: '🟩🟨⬛ **Wordle** - Guess the 5-letter word in 6 tries!',
		embeds: [embed],
		components: [row],
		fetchReply: true
	});
	
	// Wait for button click
	const collectorFilter = i => i.user.id === userId;
	
	try {
		const confirmation = await response.awaitMessageComponent({
			filter: collectorFilter,
			componentType: ComponentType.Button,
			time: 300000 // 5 minutes
		});
		
		// Show modal for guess
		const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
		
		const modal = new ModalBuilder()
			.setCustomId(`wordle-modal-${userId}`)
			.setTitle('Wordle - Enter Your Guess');
		
		const guessInput = new TextInputBuilder()
			.setCustomId('wordle-guess-input')
			.setLabel('Enter a 5-letter word')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('e.g., CRANE')
			.setMaxLength(5)
			.setRequired(true);
		
		const firstRow = new ActionRowBuilder().addComponents(guessInput);
		modal.addComponents(firstRow);
		
		await confirmation.showModal(modal);
		
	} catch (error) {
		activeGames.delete(`wordle-${userId}`);
		await interaction.editReply({
			content: 'Game expired. Use /minigames wordle to start a new game.',
			components: []
		});
	}
}

function createWordleEmbed(game) {
	const embed = new EmbedBuilder()
		.setColor(0x6aaa64)
		.setTitle('🟩 Wordle');
	
	let gridText = '';
	
	// Show guesses
	for (let i = 0; i < game.guesses.length; i++) {
		gridText += game.guesses[i].result + '\n';
	}
	
	// Show empty rows
	for (let i = game.guesses.length; i < game.maxGuesses; i++) {
		gridText += '⬛⬛⬛⬛⬛\n';
	}
	
	embed.addFields({ name: 'Grid', value: gridText || 'No guesses yet' });
	embed.addFields({ 
		name: 'Progress', 
		value: `Guesses: ${game.guesses.length}/${game.maxGuesses}` 
	});
	
	if (game.status === 'won') {
		embed.setColor(0x6aaa64);
		embed.addFields({ name: 'Result', value: '🎉 You won! The word was: **' + game.targetWord.toUpperCase() + '**' });
	} else if (game.status === 'lost') {
		embed.setColor(0xcc1100);
		embed.addFields({ name: 'Result', value: '😔 Game over! The word was: **' + game.targetWord.toUpperCase() + '**' });
	}
	
	return embed;
}

function evaluateWordleGuess(guess, target) {
	const result = [];
	const targetArr = target.toLowerCase().split('');
	const guessArr = guess.toLowerCase().split('');
	const used = new Array(5).fill(false);
	
	// First pass: find greens (correct position)
	for (let i = 0; i < 5; i++) {
		if (guessArr[i] === targetArr[i]) {
			result[i] = '🟩';
			used[i] = true;
		}
	}
	
	// Second pass: find yellows (wrong position)
	for (let i = 0; i < 5; i++) {
		if (result[i]) continue;
		
		let found = false;
		for (let j = 0; j < 5; j++) {
			if (!used[j] && guessArr[i] === targetArr[j]) {
				result[i] = '🟨';
				used[j] = true;
				found = true;
				break;
			}
		}
		
		if (!found) {
			result[i] = '⬛';
		}
	}
	
	return result.join('');
}

// Minesweeper Game
async function startMinesweeper(interaction) {
	const userId = interaction.user.id;
	const difficulty = interaction.options.getInteger('difficulty') || 1;
	
	// Check if user already has an active game
	if (activeGames.has(`minesweeper-${userId}`)) {
		return interaction.reply({
			content: 'You already have an active Minesweeper game! Finish it first.',
			ephemeral: true
		});
	}
	
	// Set grid size and mine count based on difficulty
	let rows, cols, mineCount;
	if (difficulty === 1) {
		rows = 8; cols = 8; mineCount = 10;
	} else if (difficulty === 2) {
		rows = 10; cols = 10; mineCount = 20;
	} else {
		rows = 12; cols = 12; mineCount = 30;
	}
	
	// Create grid
	const grid = createMinesweeperGrid(rows, cols, mineCount);
	
	// Game state
	const game = {
		type: 'minesweeper',
		grid: grid,
		rows: rows,
		cols: cols,
		mineCount: mineCount,
		revealed: new Set(),
		flagged: new Set(),
		status: 'active'
	};
	
	activeGames.set(`minesweeper-${userId}`, game);
	
	// Create initial message
	const embed = createMinesweeperEmbed(game);
	
	// Create buttons for the grid
	const components = createMinesweeperButtons(game);
	
	await interaction.reply({
		content: `💣 **Minesweeper** - Difficulty: ${['Easy', 'Medium', 'Hard'][difficulty - 1]}`,
		embeds: [embed],
		components: components
	});
}

function createMinesweeperGrid(rows, cols, mineCount) {
	const grid = [];
	
	// Initialize empty grid
	for (let r = 0; r < rows; r++) {
		grid[r] = [];
		for (let c = 0; c < cols; c++) {
			grid[r][c] = { isMine: false, count: 0 };
		}
	}
	
	// Place mines randomly
	let placed = 0;
	while (placed < mineCount) {
		const r = Math.floor(Math.random() * rows);
		const c = Math.floor(Math.random() * cols);
		
		if (!grid[r][c].isMine) {
			grid[r][c].isMine = true;
			placed++;
		}
	}
	
	// Calculate numbers
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (grid[r][c].isMine) continue;
			
			let count = 0;
			for (let dr = -1; dr <= 1; dr++) {
				for (let dc = -1; dc <= 1; dc++) {
					if (dr === 0 && dc === 0) continue;
					const nr = r + dr;
					const nc = c + dc;
					if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
						count++;
					}
				}
			}
			grid[r][c].count = count;
		}
	}
	
	return grid;
}

function createMinesweeperEmbed(game) {
	const embed = new EmbedBuilder()
		.setColor(0x2c3e50)
		.setTitle('💣 Minesweeper');
	
	let statusText = `Mines: ${game.flagged.size}/${game.mineCount} flagged\n`;
	statusText += `Safe cells: ${game.revealed.size}/${game.rows * game.cols - game.mineCount}`;
	
	embed.addFields({ name: 'Status', value: statusText });
	
	if (game.status === 'won') {
		embed.setColor(0x27ae60);
		embed.addFields({ name: 'Result', value: '🎉 You won! All mines cleared!' });
	} else if (game.status === 'lost') {
		embed.setColor(0xc0392b);
		embed.addFields({ name: 'Result', value: '💥 Boom! You hit a mine!' });
	}
	
	return embed;
}

function createMinesweeperButtons(game) {
	const components = [];
	
	// Limit to 5x5 for Discord button limits (max 25 buttons = 5 rows of 5)
	const displayRows = Math.min(game.rows, 5);
	const displayCols = Math.min(game.cols, 5);
	
	for (let r = 0; r < displayRows; r++) {
		const row = [];
		for (let c = 0; c < displayCols; c++) {
			const key = `${r}-${c}`;
			const isRevealed = game.revealed.has(key);
			const isFlagged = game.flagged.has(key);
			
			let label = '⬛';
			let style = ButtonStyle.Secondary;
			let disabled = false;
			
			if (isRevealed) {
				const cell = game.grid[r][c];
				if (cell.isMine) {
					label = '💣';
					style = ButtonStyle.Danger;
				} else {
					const colors = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
					label = cell.count > 0 ? colors[cell.count - 1] : '⬜';
				}
				disabled = true;
			} else if (isFlagged) {
				label = '🚩';
				style = ButtonStyle.Primary;
			}
			
			row.push(
				new ButtonBuilder()
					.setCustomId(`mine-${r}-${c}`)
					.setLabel(label)
					.setStyle(style)
					.setDisabled(disabled)
			);
		}
		components.push(new ActionRowBuilder().addComponents(...row));
	}
	
	// Add flag/reveal mode toggle
	components.push(
		new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('mine-mode-toggle')
					.setLabel('Toggle Flag Mode')
					.setStyle(ButtonStyle.Success)
			)
	);
	
	return components;
}

// Galgje (Hangman) Game
async function startGalgje(interaction) {
	const userId = interaction.user.id;
	
	// Check if user already has an active game
	if (activeGames.has(`galgje-${userId}`)) {
		return interaction.reply({
			content: 'You already have an active Galgje game! Finish it first.',
			ephemeral: true
		});
	}
	
	// Pick a random word
	const targetWord = galgjeWords[Math.floor(Math.random() * galgjeWords.length)].toLowerCase();
	
	// Game state
	const game = {
		type: 'galgje',
		targetWord: targetWord,
		guessedLetters: new Set(),
		wrongGuesses: 0,
		maxWrongGuesses: 6,
		status: 'active'
	};
	
	activeGames.set(`galgje-${userId}`, game);
	
	// Create initial embed
	const embed = createGalgjeEmbed(game);
	
	// Create alphabet buttons
	const components = createGalgjeButtons(game);
	
	await interaction.reply({
		content: '🎭 **Galgje** - Guess the word before the stick figure is complete!',
		embeds: [embed],
		components: components
	});
}

function createGalgjeEmbed(game) {
	const embed = new EmbedBuilder()
		.setColor(0x3498db)
		.setTitle('🎭 Galgje (Hangman)');
	
	// Show word with blanks
	let wordDisplay = '';
	for (const char of game.targetWord) {
		if (game.guessedLetters.has(char)) {
			wordDisplay += char + ' ';
		} else {
			wordDisplay += '_ ';
		}
	}
	
	embed.addFields({ name: 'Word', value: wordDisplay.trim() });
	
	// Draw hangman
	const hangman = drawHangman(game.wrongGuesses);
	embed.addFields({ name: 'Galgje', value: hangman });
	
	// Show guessed letters
	const guessed = Array.from(game.guessedLetters).sort().join(', ');
	embed.addFields({ 
		name: 'Guessed Letters', 
		value: guessed || 'None yet' 
	});
	
	embed.addFields({ 
		name: 'Progress', 
		value: `Wrong guesses: ${game.wrongGuesses}/${game.maxWrongGuesses}` 
	});
	
	if (game.status === 'won') {
		embed.setColor(0x27ae60);
		embed.addFields({ name: 'Result', value: '🎉 You won! The word was: **' + game.targetWord + '**' });
	} else if (game.status === 'lost') {
		embed.setColor(0xc0392b);
		embed.addFields({ name: 'Result', value: '😔 Game over! The word was: **' + game.targetWord + '**' });
	}
	
	return embed;
}

function drawHangman(wrongGuesses) {
	const parts = [
		'  ┌─────┐',
		'  │     │',
		'  │     ○',  // 1
		'  │     │',  // 2
		'  │    /│\\', // 3
		'  │     │',  // 4
		'  │    / \\', // 5
		'  │',
		'──┴──'
	];
	
	let drawing = '';
	const maxParts = Math.min(wrongGuesses + 1, 3); // Show header + body parts
	
	for (let i = 0; i < Math.min(2 + wrongGuesses, parts.length); i++) {
		drawing += parts[i] + '\n';
	}
	
	// If game is over, show full hangman
	if (wrongGuesses >= 6) {
		drawing = parts.join('\n');
	}
	
	return '```\n' + drawing + '```';
}

function createGalgjeButtons(game) {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz';
	const components = [];
	
	// Create rows of buttons (6 per row)
	for (let i = 0; i < alphabet.length; i += 6) {
		const row = [];
		for (let j = i; j < i + 6 && j < alphabet.length; j++) {
			const letter = alphabet[j];
			const isGuessed = game.guessedLetters.has(letter);
			
			row.push(
				new ButtonBuilder()
					.setCustomId(`galgje-${letter}`)
					.setLabel(letter.toUpperCase())
					.setStyle(isGuessed ? ButtonStyle.Secondary : ButtonStyle.Primary)
					.setDisabled(isGuessed || game.status !== 'active')
			);
		}
		components.push(new ActionRowBuilder().addComponents(...row));
	}
	
	return components;
}

// Export game state and helper functions for use in app.js
module.exports.activeGames = activeGames;
module.exports.createMinesweeperEmbed = createMinesweeperEmbed;
module.exports.createMinesweeperButtons = createMinesweeperButtons;
module.exports.createGalgjeEmbed = createGalgjeEmbed;
module.exports.createGalgjeButtons = createGalgjeButtons;
module.exports.createWordleEmbed = createWordleEmbed;
module.exports.evaluateWordleGuess = evaluateWordleGuess;
module.exports.wordleWords = wordleWords;
