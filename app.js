require('dotenv').config(); //This will be used to store private keys
const path = require('path');
const fs = require('fs');
const http = require('http');
const deployCommands = require('./deploy/deployCommands');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');
const getMeme = require('./commands/getMeme/getMeme');
const casinoCommand = require('./commands/casino/casino');
const welcomeCommand = require('./commands/welcome/welcome');
const goodbyeCommand = require('./commands/goodbye/goodbye');
const autoroleCommand = require('./commands/autorole/autorole');
const ticketCommand = require('./commands/ticket/ticket');
const keywordroleCommand = require('./commands/keywordrole/keywordrole');

// Store counting game state per guild
const countingGames = new Map();

// Use the shared balances map from casino.js
const balances = casinoCommand.balances;

// Use the shared settings from welcome and goodbye commands
const welcomeSettings = welcomeCommand.welcomeSettings;
const goodbyeSettings = goodbyeCommand.goodbyeSettings;
const autoroleSettings = autoroleCommand.autoroleSettings;

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('Bot is running');
}).listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

const BOT_TOKEN = process.env.CLIENT_TOKEN;

// Helper functions for ticket system
function getTicketTitle(type) {
    const titles = {
        'application': '📝 Application',
        'partnership': '🤝 Partnership',
        'question': '❓ Question',
        'complaint': '⚠️ Complaint'
    };
    return titles[type] || '🎫 Ticket';
}

function getTicketColor(type) {
    const colors = {
        'application': 0x2ecc71, // Green
        'partnership': 0x3498db, // Blue
        'question': 0xf39c12, // Orange
        'complaint': 0xe74c3c // Red
    };
    return colors[type] || 0x5865F2; // Default Discord blurple
}

function getTicketTitle(type) {
	const titles = {
		application: 'Application',
		partnership: 'Partnership',
		question: 'Question',
		complaint: 'Complaint',
		storyline: 'Storyline',
	};
	return titles[type] || 'Ticket';
}

function getTicketColor(type) {
	const colors = {
		application: 0x2ecc71,
		partnership: 0x3498db,
		question: 0xf39c12,
		complaint: 0xe74c3c,
		storyline: 0x9b59b6,
	};
	return colors[type] || 0x5865F2;
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
	],
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);


for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Register our commands
deployCommands();


client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Handle counting game messages
client.on(Events.MessageCreate, async message => {
	// Ignore bot messages
	if (message.author.bot) return;

	const guildId = message.guild?.id;
	if (!guildId) return;

	// Handle keyword-based role assignment in every server channel
	await keywordroleCommand.checkKeywordAndAssignRole(message);

	// Check if there's an active counting game in this guild
	if (!countingGames.has(guildId)) return;

	const game = countingGames.get(guildId);
	
	// Check if the message is in the counting channel
	if (message.channel.id !== game.channelId) return;

	// Ignore if it's not a number
	const number = parseInt(message.content.trim());
	if (isNaN(number)) return;

	// Check if the same person is counting twice in a row
	if (game.lastCounter === message.author.id) {
		await message.delete().catch(() => {});
		const { EmbedBuilder } = require('discord.js');
		const warningEmbed = new EmbedBuilder()
			.setColor(0xFF0000)
			.setDescription(`⚠️ ${message.author}, you can't count twice in a row!`)
			.setTimestamp();
		
		const warnMsg = await message.channel.send({ embeds: [warningEmbed] });
		setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
		return;
	}

	const expectedNumber = game.currentCount + 1;

	if (number === expectedNumber) {
		// Correct count!
		game.currentCount = number;
		game.lastCounter = message.author.id;

		// Add a checkmark emoji to the user's message
		await message.react('✅');

		// Update the game message
		const { EmbedBuilder } = require('discord.js');
		const updatedEmbed = new EmbedBuilder()
			.setColor(0x9c7453)
			.setTitle('🎯 Counting Game')
			.setDescription(
				'**How to play:**\n' +
				'• Users take turns counting up from 1\n' +
				'• Each person can only say the next number\n' +
				'• If someone makes a mistake, the counting continues\n' +
				'• Try to reach high numbers together!\n\n' +
				`**Current Count:** ${game.currentCount}\n` +
				`**Next Number:** ${game.currentCount + 1}\n\n` +
				`Last counter: ${message.author}`
			)
			.setTimestamp();

		try {
			if (game.message) {
				await game.message.edit({
					content: `🎯 **Counting:** ${game.currentCount}`,
					embeds: [updatedEmbed]
				});
			}
		} catch (error) {
			console.error('Error updating counting message:', error);
		}

		// Celebrate milestones
		if (game.currentCount % 50 === 0 && game.currentCount > 0) {
			const milestoneEmbed = new EmbedBuilder()
				.setColor(0x00FF00)
				.setTitle(`🎉 Milestone Reached! ${game.currentCount}!`)
				.setDescription(`${message.author} helped reach ${game.currentCount}!`)
				.setTimestamp();
			
			await message.channel.send({ embeds: [milestoneEmbed] });
		}

	} else if (number !== expectedNumber) {
		// Wrong number - but we continue counting anyway!
		game.lastCounter = message.author.id;
		
		// Add a cross emoji to indicate mistake
		await message.react('❌');
		
		const { EmbedBuilder } = require('discord.js');
		const mistakeEmbed = new EmbedBuilder()
			.setColor(0xFFA500)
			.setDescription(
				`❌ ${message.author} said **${number}** but the correct number was **${expectedNumber}**!\n` +
				`The counting continues from **${expectedNumber}**!`
			)
			.setTimestamp();

		const errorMsg = await message.channel.send({ embeds: [mistakeEmbed] });
		setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
	}
});

// Handle welcome messages and autorole when members join
client.on(Events.GuildMemberAdd, async member => {
	const guildId = member.guild.id;
	
	// Handle autorole - assign role automatically
	await autoroleCommand.assignAutorole(member);
	
	// Check if welcome messages are enabled for this guild
	if (!welcomeSettings.has(guildId)) return;
	
	const settings = welcomeSettings.get(guildId);
	const welcomeChannel = member.guild.channels.cache.get(settings.channelId)
		|| await member.guild.channels.fetch(settings.channelId).catch(() => null);
	
	if (!welcomeChannel || !welcomeChannel.isTextBased()) {
		console.warn(`Welcome channel not found for guild ${guildId}`);
		return;
	}
	
	// Send welcome message
	welcomeCommand.sendWelcomeMessage(member, welcomeChannel, settings.message);
});

// Handle goodbye messages when members leave
client.on(Events.GuildMemberRemove, async member => {
	const guildId = member.guild.id;
	
	// Check if goodbye messages are enabled for this guild
	if (!goodbyeSettings.has(guildId)) return;
	
	const settings = goodbyeSettings.get(guildId);
	const goodbyeChannel = member.guild.channels.cache.get(settings.channelId)
		|| await member.guild.channels.fetch(settings.channelId).catch(() => null);
	
	if (!goodbyeChannel || !goodbyeChannel.isTextBased()) {
		console.warn(`Goodbye channel not found for guild ${guildId}`);
		return;
	}
	
	// Send goodbye message
	goodbyeCommand.sendGoodbyeMessage(member.user, member.guild, goodbyeChannel, settings.message);
});

	client.on(Events.InteractionCreate, async interaction => {
		// Handle modal submissions for reviews
		if (interaction.isModalSubmit()) {
			if (interaction.customId.startsWith('review-modal-')) {
				const reviewType = interaction.customId.replace('review-modal-', '');
				
				try {
					let reviewData = {};
					let reviewTitle = '';
					let reviewDescription = '';
					
					if (reviewType === 'books') {
						reviewData = {
							title: interaction.fields.getTextInputValue('book-title'),
							author: interaction.fields.getTextInputValue('book-author'),
							stars: interaction.fields.getTextInputValue('book-stars')
						};
						reviewTitle = `📚 Book Review: ${reviewData.title}`;
						reviewDescription = `**Author:** ${reviewData.author}\n**Rating:** ${'⭐'.repeat(reviewData.stars)}${'☆'.repeat(5 - reviewData.stars)} (${reviewData.stars}/5)`;
					} else if (reviewType === 'recipes') {
						reviewData = {
							title: interaction.fields.getTextInputValue('recipe-title'),
							link: interaction.fields.getTextInputValue('recipe-link'),
							stars: interaction.fields.getTextInputValue('recipe-stars'),
							categories: interaction.fields.getTextInputValue('recipe-categories')
						};
						reviewTitle = `🍳 Recipe Review: ${reviewData.title}`;
						reviewDescription = `**Link:** ${reviewData.link}\n**Categories:** ${reviewData.categories}\n**Rating:** ${'⭐'.repeat(reviewData.stars)}${'☆'.repeat(5 - reviewData.stars)} (${reviewData.stars}/5)`;
					} else if (reviewType === 'drinks') {
						reviewData = {
							title: interaction.fields.getTextInputValue('drink-title'),
							link: interaction.fields.getTextInputValue('drink-link'),
							stars: interaction.fields.getTextInputValue('drink-stars'),
							categories: interaction.fields.getTextInputValue('drink-categories')
						};
						reviewTitle = `🍹 Drink Review: ${reviewData.title}`;
						reviewDescription = `**Link:** ${reviewData.link}\n**Categories:** ${reviewData.categories}\n**Rating:** ${'⭐'.repeat(reviewData.stars)}${'☆'.repeat(5 - reviewData.stars)} (${reviewData.stars}/5)`;
					}
					
					// Send the review to the channel where the command was used
					await interaction.channel.send({
						content: `**${reviewTitle}**\n${reviewDescription}\n*Reviewed by ${interaction.user}*`
					});
					
					await interaction.reply({ content: 'Your review has been submitted successfully!', ephemeral: true });
				} catch (error) {
					console.error(error);
					await interaction.reply({ content: 'There was an error submitting your review.', ephemeral: true });
				}
				return;
			}
		}

		// Handle button interactions for reaction roles
		if (interaction.isButton()) {
			if (interaction.customId.startsWith('reactionrole-')) {
				const roleId = interaction.customId.replace('reactionrole-', '');
				const member = interaction.member;
				const guild = interaction.guild;

				try {
					const role = await guild.roles.fetch(roleId);
					if (!role) {
						return interaction.reply({ content: 'This role no longer exists.', ephemeral: true });
					}

					if (member.roles.cache.has(roleId)) {
						// Remove the role
						await member.roles.remove(role);
						await interaction.reply({ content: `Removed the ${role.name} role from your profile.`, ephemeral: true });
					} else {
						// Add the role
						await member.roles.add(role);
						await interaction.reply({ content: `Added the ${role.name} role to your profile!`, ephemeral: true });
					}
				} catch (error) {
					console.error(error);
					await interaction.reply({ content: 'There was an error managing your roles. Make sure the bot has permission to manage roles.', ephemeral: true });
				}
				return;
			}
		}

		// Handle string select menu interactions
		if (interaction.isStringSelectMenu()) {
			// Handle ticket type selection
			if (interaction.customId === 'ticket-type') {
				const ticketType = interaction.values[0];
				const userId = interaction.user.id;
				
				// Create modal based on ticket type
				const modal = new ModalBuilder()
					.setCustomId(`ticket-modal-${ticketType}-${userId}`)
					.setTitle(`Ticket: ${getTicketTitle(ticketType)}`);
				
				// Add appropriate fields based on ticket type
				if (ticketType === 'application') {
					const ageInput = new TextInputBuilder()
						.setCustomId('ticket-age')
						.setLabel('How old are you?')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('e.g., 18')
						.setRequired(true);
					
					const positionInput = new TextInputBuilder()
						.setCustomId('ticket-position')
						.setLabel('Which position are you applying for?')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('e.g., Moderator, Admin')
						.setRequired(true);
					
					const experienceInput = new TextInputBuilder()
						.setCustomId('ticket-experience')
						.setLabel('Tell us about your experience')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Tell us about your experience...')
						.setRequired(false);
					
					const reasonInput = new TextInputBuilder()
						.setCustomId('ticket-reason')
						.setLabel('Why do you want to join our team?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Tell us why you would be a good addition...')
						.setRequired(true);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(ageInput),
						new ActionRowBuilder().addComponents(positionInput),
						new ActionRowBuilder().addComponents(experienceInput),
						new ActionRowBuilder().addComponents(reasonInput)
					);
				} else if (ticketType === 'partnership') {
					const membersInput = new TextInputBuilder()
						.setCustomId('ticket-members')
						.setLabel('How many members does your server have? (excl. bots)')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('e.g., 500')
						.setRequired(true);
					
					const serverLinkInput = new TextInputBuilder()
						.setCustomId('ticket-serverlink')
						.setLabel('Link to your server')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('https://discord.gg/...')
						.setRequired(true);
					
					const aboutInput = new TextInputBuilder()
						.setCustomId('ticket-about')
						.setLabel('Why should we partner?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Describe your server and the benefits of a partnership...')
						.setRequired(true);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(membersInput),
						new ActionRowBuilder().addComponents(serverLinkInput),
						new ActionRowBuilder().addComponents(aboutInput)
					);
				} else if (ticketType === 'question') {
					const questionInput = new TextInputBuilder()
						.setCustomId('ticket-question')
						.setLabel('What is your question?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Ask your question as clearly as possible...')
						.setRequired(true);
					
					const contextInput = new TextInputBuilder()
						.setCustomId('ticket-context')
						.setLabel('Extra context (optional)')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Add any additional information...')
						.setRequired(false);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(questionInput),
						new ActionRowBuilder().addComponents(contextInput)
					);
				} else if (ticketType === 'complaint') {
					const aboutInput = new TextInputBuilder()
						.setCustomId('ticket-about')
						.setLabel('What is your complaint about?')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('e.g., about a staff member, a rule, etc.')
						.setRequired(true);
					
					const descriptionInput = new TextInputBuilder()
						.setCustomId('ticket-description')
						.setLabel('Describe your complaint in detail')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Describe what happened, when, and who was involved...')
						.setRequired(true);
					
					const evidenceInput = new TextInputBuilder()
						.setCustomId('ticket-evidence')
						.setLabel('Evidence')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Describe what evidence you have or paste screenshots...')
						.setRequired(false);
					
					const resolutionInput = new TextInputBuilder()
						.setCustomId('ticket-resolution')
						.setLabel('What would be a good resolution?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Describe what you expect to happen...')
						.setRequired(false);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(aboutInput),
						new ActionRowBuilder().addComponents(descriptionInput),
						new ActionRowBuilder().addComponents(evidenceInput),
						new ActionRowBuilder().addComponents(resolutionInput)
					);
				} else if (ticketType === 'storyline') {
					const titleInput = new TextInputBuilder()
						.setCustomId('ticket-storyline-title')
						.setLabel('Storyline title')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('e.g., The Lost Heir')
						.setRequired(true);

					const ideaInput = new TextInputBuilder()
						.setCustomId('ticket-storyline-idea')
						.setLabel('Describe your storyline')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Tell us what the storyline is about...')
						.setRequired(true);

					const rolesInput = new TextInputBuilder()
						.setCustomId('ticket-storyline-roles')
						.setLabel('Characters or roles needed')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('List the characters, roles, or staff help needed...')
						.setRequired(false);

					const timingInput = new TextInputBuilder()
						.setCustomId('ticket-storyline-timing')
						.setLabel('Preferred timing')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('e.g., this weekend, evenings, flexible')
						.setRequired(false);

					modal.addComponents(
						new ActionRowBuilder().addComponents(titleInput),
						new ActionRowBuilder().addComponents(ideaInput),
						new ActionRowBuilder().addComponents(rolesInput),
						new ActionRowBuilder().addComponents(timingInput)
					);
				}
				
				await interaction.showModal(modal);
				return;
			}
			
			// This is handled by the review command itself, so we just ignore it here
			// The review command sets up its own collector
			return;
		}

		// Handle modal submissions for tickets
		if (interaction.isModalSubmit()) {
			if (interaction.customId.startsWith('ticket-modal-')) {
				const parts = interaction.customId.split('-');
				const ticketType = parts[2];
				const userId = parts[3];
				
				// Verify it's the right user
				if (interaction.user.id !== userId) {
					return interaction.reply({
						content: '❌ This ticket form is not intended for you.',
						ephemeral: true
					});
				}
				
				// Create ticket embed based on type
				const embed = new EmbedBuilder()
					.setColor(getTicketColor(ticketType))
					.setTitle(`🎫 ${getTicketTitle(ticketType)}`)
					.setDescription(`Ticket submitted by ${interaction.user}`)
					.addFields({ name: 'Type', value: getTicketTitle(ticketType), inline: true })
					.addFields({ name: 'Status', value: '🟡 In Progress', inline: true })
					.addFields({ name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true })
					.setFooter({ text: `Ticket ID: ${Date.now().toString(36)}` })
					.setTimestamp();
				
				// Add fields based on ticket type
				if (ticketType === 'application') {
					embed.addFields({
						name: '📝 Answers',
						value: `**Age:** ${interaction.fields.getTextInputValue('ticket-age')}\n` +
							   `**Position:** ${interaction.fields.getTextInputValue('ticket-position')}\n` +
							   `**Experience:** ${interaction.fields.getTextInputValue('ticket-experience') || 'No experience mentioned'}\n` +
							   `**Motivation:** ${interaction.fields.getTextInputValue('ticket-reason')}`
					});
				} else if (ticketType === 'partnership') {
					embed.addFields({
						name: '📝 Answers',
						value: `**Members:** ${interaction.fields.getTextInputValue('ticket-members')}\n` +
							   `**Server Link:** ${interaction.fields.getTextInputValue('ticket-serverlink')}\n` +
							   `**About Server:** ${interaction.fields.getTextInputValue('ticket-about')}`
					});
				} else if (ticketType === 'question') {
					embed.addFields({
						name: '❓ Question',
						value: interaction.fields.getTextInputValue('ticket-question')
					});
					const context = interaction.fields.getTextInputValue('ticket-context');
					if (context) {
						embed.addFields({
							name: '📌 Context',
							value: context
						});
					}
				} else if (ticketType === 'complaint') {
					embed.addFields({
						name: '⚠️ Complaint',
						value: `**Subject:** ${interaction.fields.getTextInputValue('ticket-about')}\n` +
							   `**Description:** ${interaction.fields.getTextInputValue('ticket-description')}`
					});
					const evidence = interaction.fields.getTextInputValue('ticket-evidence');
					if (evidence) {
						embed.addFields({
							name: '🔍 Evidence',
							value: evidence
						});
					}
					const resolution = interaction.fields.getTextInputValue('ticket-resolution');
					if (resolution) {
						embed.addFields({
							name: '💡 Desired Resolution',
							value: resolution
						});
					}
				} else if (ticketType === 'storyline') {
					embed.addFields({
						name: 'Storyline',
						value: `**Title:** ${interaction.fields.getTextInputValue('ticket-storyline-title')}\n` +
							   `**Idea:** ${interaction.fields.getTextInputValue('ticket-storyline-idea')}`
					});
					const roles = interaction.fields.getTextInputValue('ticket-storyline-roles');
					if (roles) {
						embed.addFields({
							name: 'Characters or Roles',
							value: roles
						});
					}
					const timing = interaction.fields.getTextInputValue('ticket-storyline-timing');
					if (timing) {
						embed.addFields({
							name: 'Preferred Timing',
							value: timing
						});
					}
				}
				
				// Send ticket to channel
				await interaction.channel.send({
					content: '🎫 **New ticket received!** Staff members will respond as soon as possible.',
					embeds: [embed]
				});
				
				// Confirm to user
				await interaction.reply({
					content: `✅ Your ${getTicketTitle(ticketType).toLowerCase()} ticket has been successfully submitted! Our staff will respond as soon as possible.`,
					ephemeral: true
				});
				
				return;
			}
		}

		// Handle chat input commands
	    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.login(BOT_TOKEN);
