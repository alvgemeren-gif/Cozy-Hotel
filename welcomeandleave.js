const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome a guest to our hotel!')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('The name of the guest')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    async execute(interaction) {
        const name = interaction.options.getString('name');
        
        // Create the welcome message
        const embed = new EmbedBuilder()
            .setColor(0x9c7453)
            .setTitle('Welcome to our hotel!')
            .setDescription(`Welcome, ${name}! We're glad to have you here.`)
            .setFooter({ 
                text: 'Hotel Vibe',
                iconURL: 'https://cdn.discordapp.com/emojis/677938877752680459.png'
            })
            .setTimestamp();
        
        // Send the welcome message to the channel
        await interaction.channel.send({
            embeds: [embed]
        });
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Bid farewell to a guest from our hotel!')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('The name of the guest')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    async execute(interaction) {
        const name = interaction.options.getString('name');
        
        // Create the departure message
        const embed = new EmbedBuilder()
            .setColor(0x9c7453)
            .setTitle('Departure from our hotel!')
            .setDescription(`Farewell, ${name}! We hope to see you again.`)
            .setFooter({ 
                text: 'Hotel Vibe',
                iconURL: 'https://cdn.discordapp.com/emojis/677938877752680459.png'
            })
            .setTimestamp();
        
        // Send the departure message to the channel
        await interaction.channel.send({
            embeds: [embed]
        });
    }
};
