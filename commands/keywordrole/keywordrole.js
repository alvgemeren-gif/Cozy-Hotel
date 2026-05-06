const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store keyword role mappings per guild (guildId -> Map<keyword, roleId>)
const keywordRoles = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('keywordrole')
        .setDescription('Manage keyword-based role assignment')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a keyword that gives a role when typed')
                .addStringOption(option =>
                    option
                        .setName('keyword')
                        .setDescription('The keyword to trigger the role (e.g., !room13Elias)')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to give when the keyword is typed')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a keyword role')
                .addStringOption(option =>
                    option
                        .setName('keyword')
                        .setDescription('The keyword to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all keyword roles')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'add') {
            const keyword = interaction.options.getString('keyword').toLowerCase();
            const role = interaction.options.getRole('role');

            // Check if role is manageable
            const botMember = interaction.guild.members.me;
            if (role.position >= botMember.roles.highest.position) {
                return interaction.reply({
                    content: '❌ I cannot assign this role! The role must be lower than my highest role.',
                    ephemeral: true
                });
            }

            if (!role.editable) {
                return interaction.reply({
                    content: '❌ I cannot manage this role! It may be managed by a higher user.',
                    ephemeral: true
                });
            }

            // Initialize guild keyword roles if not exists
            if (!keywordRoles.has(guildId)) {
                keywordRoles.set(guildId, new Map());
            }

            const guildKeywords = keywordRoles.get(guildId);
            guildKeywords.set(keyword, role.id);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Keyword Role Added!')
                .setDescription(`When someone types \`${keyword}\`, they will receive the ${role} role.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'remove') {
            const keyword = interaction.options.getString('keyword').toLowerCase();

            if (!keywordRoles.has(guildId)) {
                return interaction.reply({
                    content: '❌ No keyword roles are set up for this server.',
                    ephemeral: true
                });
            }

            const guildKeywords = keywordRoles.get(guildId);
            if (!guildKeywords.has(keyword)) {
                return interaction.reply({
                    content: `❌ No keyword role found for \`${keyword}\`.`,
                    ephemeral: true
                });
            }

            guildKeywords.delete(keyword);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🚫 Keyword Role Removed!')
                .setDescription(`The keyword \`${keyword}\` no longer gives a role.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'list') {
            if (!keywordRoles.has(guildId) || keywordRoles.get(guildId).size === 0) {
                return interaction.reply({
                    content: 'ℹ️ No keyword roles are set up for this server.',
                    ephemeral: true
                });
            }

            const guildKeywords = keywordRoles.get(guildId);
            let description = '**Active Keyword Roles:**\n\n';

            for (const [keyword, roleId] of guildKeywords) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role) {
                    description += `🔑 \`${keyword}\` → ${role}\n`;
                } else {
                    description += `🔑 \`${keyword}\` → Role not found (deleted?)\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📋 Keyword Roles List')
                .setDescription(description)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};

// Function to check if a message is a keyword and assign role
async function checkKeywordAndAssignRole(message) {
    if (message.author.bot) return;

    const guildId = message.guild?.id;
    if (!guildId) return;

    if (!keywordRoles.has(guildId)) return;

    const guildKeywords = keywordRoles.get(guildId);
    const messageContent = message.content.trim().toLowerCase();

    // Check if message matches any keyword
    if (guildKeywords.has(messageContent)) {
        const roleId = guildKeywords.get(messageContent);
        const role = message.guild.roles.cache.get(roleId);

        if (!role) {
            // Clean up deleted role
            guildKeywords.delete(messageContent);
            return;
        }

        // Check if member already has the role
        if (message.member.roles.cache.has(role.id)) {
            return; // Already has the role
        }

        try {
            await message.member.roles.add(role);
            
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription(`✅ You received the **${role.name}** role!`)
                .setFooter({ text: `Triggered by: ${messageContent}` })
                .setTimestamp();

            await message.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error assigning keyword role:', error);
        }
    }
}

// Export for use in app.js
module.exports.keywordRoles = keywordRoles;
module.exports.checkKeywordAndAssignRole = checkKeywordAndAssignRole;