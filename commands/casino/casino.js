const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Store user balances (userId -> balance)
const balances = new Map();

// Cooldown tracking (userId -> timestamp)
const workCooldowns = new Map();
const stealCooldowns = new Map();

// Cooldown times (in milliseconds)
const WORK_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const STEAL_COOLDOWN = 30 * 60 * 1000; // 30 minutes

// Work jobs with earnings
const jobs = [
    { title: '🧹 Street Cleaner', min: 10, max: 25 },
    { title: '📦 Delivery Person', min: 20, max: 40 },
    { title: '👨‍🍳 Line Cook', min: 30, max: 60 },
    { title: '📝 Freelance Writer', min: 40, max: 80 },
    { title: '💻 Web Developer', min: 60, max: 120 },
    { title: '🏗️ Construction Worker', min: 50, max: 100 },
    { title: '👨‍⚕️ Nurse', min: 80, max: 150 },
    { title: '👨‍🏫 Teacher', min: 70, max: 140 },
    { title: '⚖️ Lawyer', min: 100, max: 200 },
    { title: '👨‍💼 CEO', min: 150, max: 300 }
];

// Helper function to get or initialize balance
function getBalance(userId) {
    if (!balances.has(userId)) {
        balances.set(userId, 0);
    }
    return balances.get(userId);
}

// Helper function to set balance
function setBalance(userId, amount) {
    balances.set(userId, Math.max(0, Math.floor(amount)));
    return balances.get(userId);
}

// Helper function to format currency
function formatCurrency(amount) {
    return `💰 **${amount.toLocaleString()}** coins`;
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
                        .setDescription('Gamble your coins in a slot machine!')
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
                                .setDescription('Heads or Tails?')
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
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommandGroup === 'economy') {
            if (subcommand === 'work') {
                await executeWork(interaction);
            } else if (subcommand === 'balance') {
                await executeBalance(interaction);
            } else if (subcommand === 'gamble') {
                await executeGamble(interaction);
            } else if (subcommand === 'coinflip') {
                await executeCoinflip(interaction);
            } else if (subcommand === 'steal') {
                await executeSteal(interaction);
            }
        }
    }
};

// Work command
async function executeWork(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();
    
    // Check cooldown
    if (workCooldowns.has(userId)) {
        const cooldownEnd = workCooldowns.get(userId) + WORK_COOLDOWN;
        if (now < cooldownEnd) {
            const remaining = Math.ceil((cooldownEnd - now) / 1000 / 60);
            return interaction.reply({
                content: `⏰ You're still on cooldown! Work again in **${remaining}** minute(s).`,
                ephemeral: true
            });
        }
    }
    
    // Pick a random job
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    
    // Add earnings to balance
    const newBalance = setBalance(userId, getBalance(userId) + earnings);
    
    // Set cooldown
    workCooldowns.set(userId, now);
    
    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`${job.title}`)
        .setDescription(`You worked as a ${job.title} and earned ${formatCurrency(earnings)}!`)
        .addFields({ name: 'New Balance', value: formatCurrency(newBalance) })
        .setFooter({ text: 'Next work available in 5 minutes' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Balance command
async function executeBalance(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const balance = getBalance(targetUser.id);
    
    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('💰 Wallet')
        .setDescription(`${targetUser.tag}'s balance:`)
        .addFields({ name: 'Balance', value: formatCurrency(balance) })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Gamble command (Slot machine style)
async function executeGamble(interaction) {
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount');
    const balance = getBalance(userId);
    
    // Check if user has enough coins
    if (amount > balance) {
        return interaction.reply({
            content: `❌ You don't have enough coins! You only have ${formatCurrency(balance)}.`,
            ephemeral: true
        });
    }
    
    // Spin the slot machine
    const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
    const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
    const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
    const reel3 = symbols[Math.floor(Math.random() * symbols.length)];
    
    let winnings = 0;
    let result = 'lost';
    
    // Check for wins
    if (reel1 === reel2 && reel2 === reel3) {
        // All three match - big win!
        if (reel1 === '7️⃣') {
            winnings = amount * 10; // Jackpot!
        } else if (reel1 === '💎') {
            winnings = amount * 5;
        } else {
            winnings = amount * 3;
        }
        result = 'won';
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        // Two match - small win
        winnings = Math.floor(amount * 1.5);
        result = 'small_win';
    }
    
    // Update balance
    const newBalance = setBalance(userId, balance - amount + winnings);
    
    const embed = new EmbedBuilder()
        .setColor(result === 'won' ? 0xf1c40f : result === 'small_win' ? 0xe67e22 : 0xe74c3c)
        .setTitle('🎰 Slot Machine');
    
    let description = `You bet ${formatCurrency(amount)}!\n\n`;
    description += `**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n`;
    
    if (result === 'won') {
        description += '🎉 **JACKPOT!** You won ${formatCurrency(winnings)}!';
    } else if (result === 'small_win') {
        description += '✨ Two symbols matched! You won ${formatCurrency(winnings)}!';
    } else {
        description += '😔 No luck this time. You lost your bet.';
    }
    
    embed.setDescription(description)
        .addFields({ name: 'New Balance', value: formatCurrency(newBalance) })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Coinflip command
async function executeCoinflip(interaction) {
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount');
    const choice = interaction.options.getString('choice');
    const balance = getBalance(userId);
    
    // Check if user has enough coins
    if (amount > balance) {
        return interaction.reply({
            content: `❌ You don't have enough coins! You only have ${formatCurrency(balance)}.`,
            ephemeral: true
        });
    }
    
    // Flip the coin
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;
    
    let winnings = 0;
    if (won) {
        winnings = amount; // Win double (get bet back + same amount)
    }
    
    // Update balance
    const newBalance = setBalance(userId, balance - amount + (won ? amount * 2 : 0));
    
    const embed = new EmbedBuilder()
        .setColor(won ? 0x2ecc71 : 0xe74c3c)
        .setTitle('🪙 Coin Flip')
        .setDescription(`You bet ${formatCurrency(amount)} on **${choice}**!\n\nThe coin landed on **${result}**!`)
        .addFields({ 
            name: 'Result', 
            value: won ? `✅ You won ${formatCurrency(winnings)}!` : '❌ You lost your bet.',
            inline: true 
        })
        .addFields({ name: 'New Balance', value: formatCurrency(newBalance) })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

// Steal command
async function executeSteal(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const now = Date.now();
    
    // Can't steal from yourself
    if (targetUser.id === userId) {
        return interaction.reply({
            content: '❌ You can\'t steal from yourself!',
            ephemeral: true
        });
    }
    
    // Can't steal from bots
    if (targetUser.bot) {
        return interaction.reply({
            content: '❌ You can\'t steal from bots!',
            ephemeral: true
        });
    }
    
    // Check cooldown
    if (stealCooldowns.has(userId)) {
        const cooldownEnd = stealCooldowns.get(userId) + STEAL_COOLDOWN;
        if (now < cooldownEnd) {
            const remaining = Math.ceil((cooldownEnd - now) / 1000 / 60);
            return interaction.reply({
                content: `⏰ You're still on cooldown! Try stealing again in **${remaining}** minute(s).`,
                ephemeral: true
            });
        }
    }
    
    const targetBalance = getBalance(targetUser.id);
    
    // Check if target has any money
    if (targetBalance <= 0) {
        return interaction.reply({
            content: `❌ ${targetUser.tag} has no coins to steal!`,
            ephemeral: true
        });
    }
    
    // Calculate steal amount (10-50% of target's balance)
    const stealPercent = Math.random() * 0.4 + 0.1; // 10-50%
    const stealAmount = Math.floor(targetBalance * stealPercent);
    
    // 60% chance of success
    const successChance = Math.random();
    const success = successChance < 0.6;
    
    if (success) {
        // Successful steal
        setBalance(targetUser.id, targetBalance - stealAmount);
        setBalance(userId, getBalance(userId) + stealAmount);
        
        // Set cooldown
        stealCooldowns.set(userId, now);
        
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🗡️ Successful Heist!')
            .setDescription(`You successfully stole ${formatCurrency(stealAmount)} from ${targetUser.tag}!`)
            .addFields({ name: 'Your New Balance', value: formatCurrency(getBalance(userId)) })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } else {
        // Failed steal - lose some money as penalty
        const penalty = Math.floor(stealAmount * 0.5);
        setBalance(userId, getBalance(userId) - penalty);
        
        // Set cooldown
        stealCooldowns.set(userId, now);
        
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🚨 Heist Failed!')
            .setDescription(`You tried to steal from ${targetUser.tag} but got caught!`)
            .addFields({ 
                name: 'Penalty', 
                value: `You lost ${formatCurrency(penalty)} as a fine.`,
                inline: true 
            })
            .addFields({ name: 'Your New Balance', value: formatCurrency(getBalance(userId)) })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
}

// Export the balances map for use in app.js
module.exports.balances = balances;