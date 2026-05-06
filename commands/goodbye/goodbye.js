const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store goodbye message settings per guild (guildId -> { channelId, message })
const goodbyeSettings = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setgoodbye')
        .setDescription('Set up goodbye messages for members who leave')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to send goodbye messages in')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Custom goodbye message (use {user} for user mention, {server} for server name)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const customMessage = interaction.options.getString('message');
        const guildId = interaction.guild.id;
        
        // Save settings
        goodbyeSettings.set(guildId, {
            channelId: channel.id,
            message: customMessage || '👋 **{user}** has left **{server}**. We will miss them! 😢'
        });
        
        // Create confirmation embed
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('✅ Goodbye message ingesteld!')
            .setDescription(`Goodbye berichten worden nu verstuurd in ${channel}`)
            .addFields({
                name: 'Bericht',
                value: customMessage || '👋 **{user}** has left **{server}**. We will miss them! 😢'
            })
            .addFields({
                name: 'Variabelen',
                value: '{user} - Vermelding van de gebruiker\n{server} - Naam van the server\n{membercount} - Aantal members'
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};

// Function to send goodbye message (called from app.js)
function sendGoodbyeMessage(user, guild, goodbyeChannel, customMessage) {
    const message = customMessage
        .replace(/{user}/g, user.tag)
        .replace(/{server}/g, guild.name)
        .replace(/{membercount}/g, guild.memberCount.toString());
    
    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(message)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();
    
    goodbyeChannel.send({ embeds: [embed] }).catch(console.error);
}

// Export for use in app.js
module.exports.goodbyeSettings = goodbyeSettings;
module.exports.sendGoodbyeMessage = sendGoodbyeMessage;