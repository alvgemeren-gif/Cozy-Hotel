const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const balances = new Map();
const workCooldowns = new Map();
const stealCooldowns = new Map();

const WORK_COOLDOWN = 5 * 60 * 1000;
const STEAL_COOLDOWN = 30 * 60 * 1000;

const jobs = [
	{ title: 'Street Cleaner', min: 10, max: 25 },
	{ title: 'Delivery Person', min: 20, max: 40 },
	{ title: 'Line Cook', min: 30, max: 60 },
	{ title: 'Freelance Writer', min: 40, max: 80 },
	{ title: 'Web Developer', min: 60, max: 120 },
	{ title: 'Construction Worker', min: 50, max: 100 },
	{ title: 'Nurse', min: 80, max: 150 },
	{ title: 'Teacher', min: 70, max: 140 },
	{ title: 'Lawyer', min: 100, max: 200 },
	{ title: 'CEO', min: 150, max: 300 },
];

function getBalance(userId) {
	if (!balances.has(userId)) {
		balances.set(userId, 0);
	}
	return balances.get(userId);
}

function setBalance(userId, amount) {
	balances.set(userId, Math.max(0, Math.floor(amount)));
	return balances.get(userId);
}

function formatCurrency(amount) {
	return `**${amount.toLocaleString()}** coins`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('casino')
		.setDescription('Casino and economy commands')
		.addSubcommandGroup(group =>
			group
				.setName('economy')
				.setDescription('Economy related commands')
				.addSubcommand(subcommand =>
					subcommand
						.setName('work')
						.setDescription('Work to earn some coins')
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('balance')
						.setDescription('Check your coin balance')
						.addUserOption(option =>
							option
								.setName('user')
								.setDescription('Check another user balance')
								.setRequired(false)
						)
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('gamble')
						.setDescription('Gamble your coins in a slot machine')
						.addIntegerOption(option =>
							option
								.setName('amount')
								.setDescription('Amount of coins to bet')
								.setRequired(true)
								.setMinValue(1)
						)
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('coinflip')
						.setDescription('Flip a coin and double or lose your bet')
						.addIntegerOption(option =>
							option
								.setName('amount')
								.setDescription('Amount of coins to bet')
								.setRequired(true)
								.setMinValue(1)
						)
						.addStringOption(option =>
							option
								.setName('choice')
								.setDescription('Heads or tails?')
								.setRequired(true)
								.addChoices(
									{ name: 'Heads', value: 'heads' },
									{ name: 'Tails', value: 'tails' }
								)
						)
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('steal')
						.setDescription('Try to steal coins from another user')
						.addUserOption(option =>
							option
								.setName('target')
								.setDescription('The user to steal from')
								.setRequired(true)
						)
				)
		),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'work') {
			return executeWork(interaction);
		}
		if (subcommand === 'balance') {
			return executeBalance(interaction);
		}
		if (subcommand === 'gamble') {
			return executeGamble(interaction);
		}
		if (subcommand === 'coinflip') {
			return executeCoinflip(interaction);
		}
		if (subcommand === 'steal') {
			return executeSteal(interaction);
		}
	},
};

async function executeWork(interaction) {
	const userId = interaction.user.id;
	const now = Date.now();

	if (workCooldowns.has(userId)) {
		const cooldownEnd = workCooldowns.get(userId) + WORK_COOLDOWN;
		if (now < cooldownEnd) {
			const remaining = Math.ceil((cooldownEnd - now) / 1000 / 60);
			return interaction.reply({
				content: `You are still on cooldown. Work again in **${remaining}** minute(s).`,
				ephemeral: true,
			});
		}
	}

	const job = jobs[Math.floor(Math.random() * jobs.length)];
	const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
	const newBalance = setBalance(userId, getBalance(userId) + earnings);
	workCooldowns.set(userId, now);

	const embed = new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle(job.title)
		.setDescription(`You worked as a **${job.title}** and earned ${formatCurrency(earnings)}.`)
		.addFields({ name: 'New Balance', value: formatCurrency(newBalance) })
		.setFooter({ text: 'Next work available in 5 minutes' })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

async function executeBalance(interaction) {
	const targetUser = interaction.options.getUser('user') || interaction.user;
	const balance = getBalance(targetUser.id);

	const embed = new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Wallet')
		.setDescription(`${targetUser.tag}'s balance:`)
		.addFields({ name: 'Balance', value: formatCurrency(balance) })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

async function executeGamble(interaction) {
	const userId = interaction.user.id;
	const amount = interaction.options.getInteger('amount');
	const balance = getBalance(userId);

	if (amount > balance) {
		return interaction.reply({
			content: `You do not have enough coins. You only have ${formatCurrency(balance)}.`,
			ephemeral: true,
		});
	}

	const symbols = ['CHERRY', 'LEMON', 'ORANGE', 'GRAPE', 'DIAMOND', 'SEVEN'];
	const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
	const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
	const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

	let winnings = 0;
	let result = 'lost';

	if (reel1 === reel2 && reel2 === reel3) {
		if (reel1 === 'SEVEN') {
			winnings = amount * 10;
		} else if (reel1 === 'DIAMOND') {
			winnings = amount * 5;
		} else {
			winnings = amount * 3;
		}
		result = 'won';
	} else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
		winnings = Math.floor(amount * 1.5);
		result = 'small_win';
	}

	const newBalance = setBalance(userId, balance - amount + winnings);
	const embed = new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Slot Machine');

	let description = `You bet ${formatCurrency(amount)}.\n\n`;
	description += `**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n`;

	if (result === 'won') {
		description += `**JACKPOT!** You won ${formatCurrency(winnings)}.`;
	} else if (result === 'small_win') {
		description += `Two symbols matched. You won ${formatCurrency(winnings)}.`;
	} else {
		description += 'No luck this time. You lost your bet.';
	}

	embed
		.setDescription(description)
		.addFields({ name: 'New Balance', value: formatCurrency(newBalance) })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

async function executeCoinflip(interaction) {
	const userId = interaction.user.id;
	const amount = interaction.options.getInteger('amount');
	const choice = interaction.options.getString('choice');
	const balance = getBalance(userId);

	if (amount > balance) {
		return interaction.reply({
			content: `You do not have enough coins. You only have ${formatCurrency(balance)}.`,
			ephemeral: true,
		});
	}

	const result = Math.random() < 0.5 ? 'heads' : 'tails';
	const won = choice === result;
	const winnings = won ? amount : 0;
	const newBalance = setBalance(userId, balance - amount + (won ? amount * 2 : 0));

	const embed = new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Coin Flip')
		.setDescription(`You bet ${formatCurrency(amount)} on **${choice}**.\n\nThe coin landed on **${result}**.`)
		.addFields({
			name: 'Result',
			value: won ? `You won ${formatCurrency(winnings)}.` : 'You lost your bet.',
			inline: true,
		})
		.addFields({ name: 'New Balance', value: formatCurrency(newBalance) })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

async function executeSteal(interaction) {
	const userId = interaction.user.id;
	const targetUser = interaction.options.getUser('target');
	const now = Date.now();

	if (targetUser.id === userId) {
		return interaction.reply({ content: 'You cannot steal from yourself.', ephemeral: true });
	}

	if (targetUser.bot) {
		return interaction.reply({ content: 'You cannot steal from bots.', ephemeral: true });
	}

	if (stealCooldowns.has(userId)) {
		const cooldownEnd = stealCooldowns.get(userId) + STEAL_COOLDOWN;
		if (now < cooldownEnd) {
			const remaining = Math.ceil((cooldownEnd - now) / 1000 / 60);
			return interaction.reply({
				content: `You are still on cooldown. Try stealing again in **${remaining}** minute(s).`,
				ephemeral: true,
			});
		}
	}

	const targetBalance = getBalance(targetUser.id);

	if (targetBalance <= 0) {
		return interaction.reply({
			content: `${targetUser.tag} has no coins to steal.`,
			ephemeral: true,
		});
	}

	const stealPercent = Math.random() * 0.4 + 0.1;
	const stealAmount = Math.floor(targetBalance * stealPercent);
	const success = Math.random() < 0.6;
	stealCooldowns.set(userId, now);

	if (success) {
		setBalance(targetUser.id, targetBalance - stealAmount);
		setBalance(userId, getBalance(userId) + stealAmount);

		const embed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle('Successful Heist')
			.setDescription(`You successfully stole ${formatCurrency(stealAmount)} from ${targetUser.tag}.`)
			.addFields({ name: 'Your New Balance', value: formatCurrency(getBalance(userId)) })
			.setTimestamp();

		return interaction.reply({ embeds: [embed] });
	}

	const penalty = Math.floor(stealAmount * 0.5);
	setBalance(userId, getBalance(userId) - penalty);

	const embed = new EmbedBuilder()
		.setColor(0x9c7453)
		.setTitle('Heist Failed')
		.setDescription(`You tried to steal from ${targetUser.tag} but got caught.`)
		.addFields({
			name: 'Penalty',
			value: `You lost ${formatCurrency(penalty)} as a fine.`,
			inline: true,
		})
		.addFields({ name: 'Your New Balance', value: formatCurrency(getBalance(userId)) })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

module.exports.balances = balances;
