const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store welcome message settings per guild (guildId -> { channelId, message })
const welcomeSettings = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Set up welcome messages for new members')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to send welcome messages in')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Custom welcome message (use {user} for user mention, {server} for server name)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const customMessage = interaction.options.getString('message');
        const guildId = interaction.guild.id;
        
        // Save settings
        welcomeSettings.set(guildId, {
            channelId: channel.id,
            message: customMessage || '🎉 Welkom {user} op **{server}**! We zijn blij je hier te hebben! 🎉'
        });
        
        // Create confirmation embed
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Welkomstbericht ingesteld!')
            .setDescription(`Welkomstberichten worden nu verstuurd in ${channel}`)
            .addFields({
                name: 'Bericht',
                value: customMessage || '🎉 Welkom {user} op **{server}**! We zijn blij je hier te hebben! 🎉'
            })
            .addFields({
                name: 'Variabelen',
                value: '{user} - Vermelding van de gebruiker\n{server} - Naam van the server\n{membercount} - Aantal members'
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};

// Function to send welcome message (called from app.js)
function sendWelcomeMessage(member, welcomeChannel, customMessage) {
    const message = customMessage
        .replace(/{user}/g, member.toString())
        .replace(/{server}/g, member.guild.name)
        .replace(/{membercount}/g, member.guild.memberCount.toString());
    
    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription(message)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
    
    welcomeChannel.send({ embeds: [embed] }).catch(console.error);
}

// Export for use in app.js
module.exports.welcomeSettings = welcomeSettings;
module.exports.sendWelcomeMessage = sendWelcomeMessage;