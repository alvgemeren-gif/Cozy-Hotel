const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
} = require('discord.js');

const BOARD_SIZE = 4;
const DEFAULT_MINES = 4;
const activeGames = new Map();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('minesweeper')
		.setDescription('Start an interactive Minesweeper game')
		.addIntegerOption(option =>
			option
				.setName('mines')
				.setDescription('Number of mines on the 4x4 board')
				.setRequired(false)
				.setMinValue(3)
				.setMaxValue(8)
		),

	async execute(interaction) {
		const userId = interaction.user.id;

		if (activeGames.has(userId)) {
			return interaction.reply({
				content: 'You already have a Minesweeper game running.',
				ephemeral: true,
			});
		}

		const mineCount = interaction.options.getInteger('mines') || DEFAULT_MINES;
		const game = createGame(mineCount);
		activeGames.set(userId, game);

		const response = await interaction.reply({
			embeds: [buildEmbed(game, 'Reveal every safe tile without hitting a mine.')],
			components: buildComponents(game),
			fetchReply: true,
		});

		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 10 * 60 * 1000,
		});

		collector.on('collect', async buttonInteraction => {
			if (buttonInteraction.user.id !== userId) {
				return buttonInteraction.reply({
					content: 'This is not your Minesweeper board.',
					ephemeral: true,
				});
			}

			const [, action, rawIndex] = buttonInteraction.customId.split(':');

			if (action === 'mode') {
				game.flagMode = !game.flagMode;
				return buttonInteraction.update({
					embeds: [buildEmbed(game, game.flagMode ? 'Flag mode enabled.' : 'Reveal mode enabled.')],
					components: buildComponents(game),
				});
			}

			if (action === 'stop') {
				activeGames.delete(userId);
				collector.stop('stopped');
				game.finished = true;
				return buttonInteraction.update({
					embeds: [buildEmbed(game, 'Game stopped.')],
					components: buildComponents(game, true),
				});
			}

			const index = Number(rawIndex);
			if (!Number.isInteger(index)) return;

			const tile = game.tiles[index];
			if (!tile || tile.revealed) {
				return buttonInteraction.deferUpdate();
			}

			if (game.flagMode) {
				tile.flagged = !tile.flagged;
				return buttonInteraction.update({
					embeds: [buildEmbed(game, tile.flagged ? 'Tile flagged.' : 'Flag removed.')],
					components: buildComponents(game),
				});
			}

			if (tile.flagged) {
				return buttonInteraction.reply({
					content: 'That tile is flagged. Turn on flag mode and unflag it first.',
					ephemeral: true,
				});
			}

			if (tile.mine) {
				tile.revealed = true;
				game.finished = true;
				activeGames.delete(userId);
				collector.stop('lost');
				revealAllMines(game);
				return buttonInteraction.update({
					embeds: [buildEmbed(game, 'You hit a mine. Game over.')],
					components: buildComponents(game, true),
				});
			}

			revealTile(game, index);

			if (hasWon(game)) {
				game.finished = true;
				activeGames.delete(userId);
				collector.stop('won');
				return buttonInteraction.update({
					embeds: [buildEmbed(game, 'You cleared the board. You win.')],
					components: buildComponents(game, true),
				});
			}

			return buttonInteraction.update({
				embeds: [buildEmbed(game, 'Safe tile revealed.')],
				components: buildComponents(game),
			});
		});

		collector.on('end', async (_collected, reason) => {
			if (reason === 'won' || reason === 'lost' || reason === 'stopped') return;
			if (!activeGames.has(userId)) return;

			activeGames.delete(userId);
			game.finished = true;
			await interaction.editReply({
				embeds: [buildEmbed(game, 'The Minesweeper game ended after 10 minutes.')],
				components: buildComponents(game, true),
			}).catch(() => {});
		});
	},
};

function createGame(mineCount) {
	const tiles = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_value, index) => ({
		index,
		mine: false,
		revealed: false,
		flagged: false,
		nearby: 0,
	}));

	const mineIndexes = new Set();
	while (mineIndexes.size < mineCount) {
		mineIndexes.add(Math.floor(Math.random() * tiles.length));
	}

	for (const index of mineIndexes) {
		tiles[index].mine = true;
	}

	for (const tile of tiles) {
		tile.nearby = getNeighbors(tile.index)
			.filter(neighborIndex => tiles[neighborIndex].mine)
			.length;
	}

	return {
		tiles,
		mineCount,
		flagMode: false,
		finished: false,
	};
}

function buildEmbed(game, status) {
	const revealed = game.tiles.filter(tile => tile.revealed && !tile.mine).length;
	const safeTiles = game.tiles.length - game.mineCount;
	const flags = game.tiles.filter(tile => tile.flagged).length;

	return new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Minesweeper')
		.setDescription(renderBoard(game))
		.addFields(
			{ name: 'Mode', value: game.flagMode ? 'Flag' : 'Reveal', inline: true },
			{ name: 'Mines', value: `${game.mineCount}`, inline: true },
			{ name: 'Progress', value: `${revealed}/${safeTiles}`, inline: true },
			{ name: 'Flags', value: `${flags}`, inline: true },
			{ name: 'Status', value: status }
		)
		.setFooter({ text: 'Click a tile to reveal it. Use Flag Mode to mark mines.' })
		.setTimestamp();
}

function renderBoard(game) {
	const rows = [];

	for (let y = 0; y < BOARD_SIZE; y++) {
		const row = [];
		for (let x = 0; x < BOARD_SIZE; x++) {
			const tile = game.tiles[y * BOARD_SIZE + x];
			row.push(renderTile(tile, game.finished));
		}
		rows.push(row.join(' '));
	}

	return `\`\`\`\n${rows.join('\n')}\n\`\`\``;
}

function renderTile(tile, finished) {
	if (tile.flagged && !tile.revealed) return 'F';
	if (!tile.revealed && !(finished && tile.mine)) return '#';
	if (tile.mine) return '*';
	return tile.nearby === 0 ? '.' : `${tile.nearby}`;
}

function buildComponents(game, disabled = false) {
	const rows = [];

	for (let y = 0; y < BOARD_SIZE; y++) {
		const row = new ActionRowBuilder();

		for (let x = 0; x < BOARD_SIZE; x++) {
			const index = y * BOARD_SIZE + x;
			const tile = game.tiles[index];
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`ms:tile:${index}`)
					.setLabel(getButtonLabel(tile, disabled))
					.setStyle(getButtonStyle(tile, disabled))
					.setDisabled(disabled || tile.revealed)
			);
		}

		rows.push(row);
	}

	const controls = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('ms:mode:toggle')
			.setLabel(game.flagMode ? 'Flag Mode' : 'Reveal Mode')
			.setStyle(game.flagMode ? ButtonStyle.Secondary : ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId('ms:stop:game')
			.setLabel('Stop')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled)
	);

	return [...rows, controls];
}

function getButtonLabel(tile, disabled) {
	if (tile.flagged && !tile.revealed) return 'F';
	if (!tile.revealed && !(disabled && tile.mine)) return '?';
	if (tile.mine) return '*';
	return tile.nearby === 0 ? '-' : `${tile.nearby}`;
}

function getButtonStyle(tile, disabled) {
	if (tile.flagged && !tile.revealed) return ButtonStyle.Secondary;
	if (!tile.revealed && !(disabled && tile.mine)) return ButtonStyle.Primary;
	if (tile.mine) return ButtonStyle.Danger;
	return ButtonStyle.Success;
}

function revealTile(game, index) {
	const tile = game.tiles[index];
	if (!tile || tile.revealed || tile.flagged) return;

	tile.revealed = true;

	if (tile.nearby !== 0) return;

	for (const neighborIndex of getNeighbors(index)) {
		revealTile(game, neighborIndex);
	}
}

function revealAllMines(game) {
	for (const tile of game.tiles) {
		if (tile.mine) {
			tile.revealed = true;
		}
	}
}

function getNeighbors(index) {
	const x = index % BOARD_SIZE;
	const y = Math.floor(index / BOARD_SIZE);
	const neighbors = [];

	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;

			const nx = x + dx;
			const ny = y + dy;

			if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
				neighbors.push(ny * BOARD_SIZE + nx);
			}
		}
	}

	return neighbors;
}

function hasWon(game) {
	return game.tiles.every(tile => tile.mine || tile.revealed);
}

module.exports.activeGames = activeGames;
