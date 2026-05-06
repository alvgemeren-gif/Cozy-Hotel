const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ghostmessage')
        .setDescription('Send a message as a ghost (your identity remains hidden)')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('The message you want the bot to send')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('Attach an image to the ghost message')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    async execute(interaction) {
        const message = interaction.options.getString('message');
        const attachment = interaction.options.getAttachment('image');
        
        // Acknowledge the user's input privately
        await interaction.reply({
            content: '👻 Je ghost message is verzonden! Niemand kan zien dat jij het stuurde.',
            ephemeral: true
        });
        
        // Create the ghost message
        const embed = new EmbedBuilder()
            .setColor(0x95a5a6) // Ghostly gray color
            .setDescription(message)
            .setFooter({ 
                text: '👻 Verzonden door een geest...', 
                iconURL: 'https://cdn.discordapp.com/emojis/677938877752680459.png'
            })
            .setTimestamp();
        
        // Add image if provided
        if (attachment) {
            embed.setImage(attachment.url);
        }
        
        // Send the ghost message to the channel
        await interaction.channel.send({
            embeds: [embed]
        });
    }
};