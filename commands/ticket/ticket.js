const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ComponentType } = require('discord.js');

// Store ticket settings per guild
const ticketSettings = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Create a ticket support panel')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel where the ticket panel will be sent')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('Title for the ticket panel (default: Support Panel)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Description for the ticket panel')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const customTitle = interaction.options.getString('title') || '📋 Support Panel';
        const customDescription = interaction.options.getString('description') || 
            'Select the type of support you need below. Our team will respond to your ticket as soon as possible.';

        // Create the select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket-type')
            .setPlaceholder('Select the type of ticket...')
            .addOptions([
                {
                    label: '📝 Sollicitatie',
                    description: 'Apply for a staff position',
                    value: 'sollicitatie'
                },
                {
                    label: '🤝 Partnership',
                    description: 'Propose a partnership',
                    value: 'partnership'
                },
                {
                    label: '❓ Vraag',
                    description: 'Ask a general question',
                    value: 'question'
                },
                {
                    label: '⚠️ Klacht',
                    description: 'Submit a complaint',
                    value: 'complaint'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(customTitle)
            .setDescription(customDescription)
            .addFields({
                name: '📋 Ticket Types',
                value: '**📝 Sollicitatie** - Solliciteer voor een staff positie\n' +
                       '**🤝 Partnership** - Vraag een partnerschap aan\n' +
                       '**❓ Vraag** - Stel een algemene vraag\n' +
                       '**⚠️ Klacht** - Dien een klacht in\n\n' +
                       'Kies hierboven het type ticket dat bij jouw situatie past.'
            })
            .setFooter({ text: 'Cozy Hotel Support Team' })
            .setTimestamp();

        // Send the ticket panel
        await channel.send({
            content: '🎫 **Support Panel** - Selecteer hieronder het type ticket:',
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content: `✅ Ticket panel verzonden in ${channel}!`,
            ephemeral: true
        });
    }
};

// Export for use in app.js
module.exports.ticketSettings = ticketSettings;