const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store autorole settings per guild (guildId -> { roleId })
const autoroleSettings = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manage automatic role assignment for new members')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the role that new members will automatically receive')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to automatically assign to new members')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove the automatic role assignment')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show the current autorole setting')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'set') {
            const role = interaction.options.getRole('role');
            
            // Check if role is higher than bot's highest role
            const botMember = interaction.guild.members.me;
            if (role.position >= botMember.roles.highest.position) {
                return interaction.reply({
                    content: '❌ Ik kan deze rol niet toewijzen! De rol moet lager zijn dan mijn hoogste rol.',
                    ephemeral: true
                });
            }

            // Check if role is manageable by the bot
            if (!role.editable) {
                return interaction.reply({
                    content: '❌ Ik kan deze rol niet beheren! De rol wordt mogelijk beheerd door een hogere gebruiker.',
                    ephemeral: true
                });
            }

            // Save setting
            autoroleSettings.set(guildId, { roleId: role.id });

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Autorole ingesteld!')
                .setDescription(`Nieuwe members krijgen nu automatisch de rol ${role}`)
                .addFields({
                    name: 'Rol',
                    value: `${role.name} (${role.id})`
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'remove') {
            if (!autoroleSettings.has(guildId)) {
                return interaction.reply({
                    content: '❌ Er is geen autorole ingesteld voor this server.',
                    ephemeral: true
                });
            }

            autoroleSettings.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🚫 Autorole verwijderd!')
                .setDescription('Nieuwe members krijgen geen automatische rol meer.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'show') {
            if (!autoroleSettings.has(guildId)) {
                return interaction.reply({
                    content: 'ℹ️ Er is geen autorole ingesteld voor this server.',
                    ephemeral: true
                });
            }

            const settings = autoroleSettings.get(guildId);
            const role = interaction.guild.roles.cache.get(settings.roleId);

            if (!role) {
                // Role no longer exists
                autoroleSettings.delete(guildId);
                return interaction.reply({
                    content: '⚠️ De ingestelde autorole bestaat niet meer. Gebruik `/autorole set` om een nieuwe in te stellen.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📋 Huidige Autorole Instelling')
                .setDescription(`Nieuwe members krijgen automatisch de rol ${role}`)
                .addFields({
                    name: 'Rol',
                    value: `${role.name} (${role.id})`,
                    inline: true
                },
                {
                    name: 'Kleur',
                    value: role.hexColor,
                    inline: true
                })
                .setThumbnail(role.iconURL() || role.guild.iconURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};

// Function to assign autorole to a member (called from app.js)
async function assignAutorole(member) {
    const guildId = member.guild.id;
    
    // Check if autorole is enabled for this guild
    if (!autoroleSettings.has(guildId)) return;
    
    const settings = autoroleSettings.get(guildId);
    const role = member.guild.roles.cache.get(settings.roleId);
    
    if (!role) {
        console.warn(`Autorole role not found for guild ${guildId}`);
        // Clean up invalid setting
        autoroleSettings.delete(guildId);
        return;
    }

    try {
        await member.roles.add(role);
        console.log(`Assigned autorole ${role.name} to ${member.user.tag} in ${member.guild.name}`);
    } catch (error) {
        console.error(`Failed to assign autorole to ${member.user.tag}:`, error);
    }
}

// Export for use in app.js
module.exports.autoroleSettings = autoroleSettings;
module.exports.assignAutorole = assignAutorole;