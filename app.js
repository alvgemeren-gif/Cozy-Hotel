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
        'sollicitatie': '📝 Sollicitatie',
        'partnership': '🤝 Partnership',
        'question': '❓ Vraag',
        'complaint': '⚠️ Klacht'
    };
    return titles[type] || '🎫 Ticket';
}

function getTicketColor(type) {
    const colors = {
        'sollicitatie': 0x2ecc71, // Green
        'partnership': 0x3498db, // Blue
        'question': 0xf39c12, // Orange
        'complaint': 0xe74c3c // Red
    };
    return colors[type] || 0x5865F2; // Default Discord blurple
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

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
	const welcomeChannel = member.guild.channels.cache.get(settings.channelId);
	
	if (!welcomeChannel) {
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
	const goodbyeChannel = member.guild.channels.cache.get(settings.channelId);
	
	if (!goodbyeChannel) {
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
				if (ticketType === 'sollicitatie') {
					const ageInput = new TextInputBuilder()
						.setCustomId('ticket-age')
						.setLabel('Hoe old ben je?')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('Bijv. 18')
						.setRequired(true);
					
					const positionInput = new TextInputBuilder()
						.setCustomId('ticket-position')
						.setLabel('Voor welke positie wil je solliciteren?')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('Bijv. Moderator, Admin')
						.setRequired(true);
					
					const experienceInput = new TextInputBuilder()
						.setCustomId('ticket-experience')
						.setLabel('Heb je ervaring? Zo ja, vertel erover.')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Vertel over je ervaring...')
						.setRequired(false);
					
					const reasonInput = new TextInputBuilder()
						.setCustomId('ticket-reason')
						.setLabel('Waarom wil je bij ons team?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Vertel waarom jij een goede aanwinst zou zijn...')
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
						.setLabel('Hoeveel members heeft jouw server? (excl. bots)')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('Bijv. 500')
						.setRequired(true);
					
					const serverLinkInput = new TextInputBuilder()
						.setCustomId('ticket-serverlink')
						.setLabel('Link naar jouw server')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('https://discord.gg/...')
						.setRequired(true);
					
					const aboutInput = new TextInputBuilder()
						.setCustomId('ticket-about')
						.setLabel('Vertel over jouw server en waarom een partnership?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Beschrijf jouw server en de voordelen van een partnership...')
						.setRequired(true);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(membersInput),
						new ActionRowBuilder().addComponents(serverLinkInput),
						new ActionRowBuilder().addComponents(aboutInput)
					);
				} else if (ticketType === 'question') {
					const questionInput = new TextInputBuilder()
						.setCustomId('ticket-question')
						.setLabel('Wat is jouw vraag?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Stel je vraag zo duidelijk mogelijk...')
						.setRequired(true);
					
					const contextInput = new TextInputBuilder()
						.setCustomId('ticket-context')
						.setLabel('Extra context (optioneel)')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Voeg eventueel extra informatie toe...')
						.setRequired(false);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(questionInput),
						new ActionRowBuilder().addComponents(contextInput)
					);
				} else if (ticketType === 'complaint') {
					const aboutInput = new TextInputBuilder()
						.setCustomId('ticket-about')
						.setLabel('Waar gaat je klacht over?')
						.setStyle(TextInputStyle.Short)
						.setPlaceholder('Bijv. over een staff member, een regel, etc.')
						.setRequired(true);
					
					const descriptionInput = new TextInputBuilder()
						.setCustomId('ticket-description')
						.setLabel('Beschrijf je klacht gedetailleerd')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Beschrijf wat er is gebeurd, wanneer, en betrokken personen...')
						.setRequired(true);
					
					const evidenceInput = new TextInputBuilder()
						.setCustomId('ticket-evidence')
						.setLabel('Heb je bewijs? (screenshots, logs, etc.)')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Beschrijf welk bewijs je hebt of plak screenshots...')
						.setRequired(false);
					
					const resolutionInput = new TextInputBuilder()
						.setCustomId('ticket-resolution')
						.setLabel('Wat zou een goede oplossing zijn?')
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder('Beschrijf wat je verwacht dat er gebeurt...')
						.setRequired(false);
					
					modal.addComponents(
						new ActionRowBuilder().addComponents(aboutInput),
						new ActionRowBuilder().addComponents(descriptionInput),
						new ActionRowBuilder().addComponents(evidenceInput),
						new ActionRowBuilder().addComponents(resolutionInput)
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
						content: '❌ Dit ticket formulier is niet voor jou bestemd.',
						ephemeral: true
					});
				}
				
				// Create ticket embed based on type
				const embed = new EmbedBuilder()
					.setColor(getTicketColor(ticketType))
					.setTitle(`🎫 ${getTicketTitle(ticketType)}`)
					.setDescription(`Ticket ingediend door ${interaction.user}`)
					.addFields({ name: 'Type', value: getTicketTitle(ticketType), inline: true })
					.addFields({ name: 'Status', value: '🟡 In behandeling', inline: true })
					.addFields({ name: 'Aangemaakt', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true })
					.setFooter({ text: `Ticket ID: ${Date.now().toString(36)}` })
					.setTimestamp();
				
				// Add fields based on ticket type
				if (ticketType === 'sollicitatie') {
					embed.addFields({
						name: '📝 Antwoorden',
						value: `**Leeftijd:** ${interaction.fields.getTextInputValue('ticket-age')}\n` +
							   `**Positie:** ${interaction.fields.getTextInputValue('ticket-position')}\n` +
							   `**Ervaring:** ${interaction.fields.getTextInputValue('ticket-experience') || 'Geen ervaring vermeld'}\n` +
							   `**Motivatie:** ${interaction.fields.getTextInputValue('ticket-reason')}`
					});
				} else if (ticketType === 'partnership') {
					embed.addFields({
						name: '📝 Antwoorden',
						value: `**Members:** ${interaction.fields.getTextInputValue('ticket-members')}\n` +
							   `**Server Link:** ${interaction.fields.getTextInputValue('ticket-serverlink')}\n` +
							   `**Over Server:** ${interaction.fields.getTextInputValue('ticket-about')}`
					});
				} else if (ticketType === 'question') {
					embed.addFields({
						name: '❓ Vraag',
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
						name: '⚠️ Klacht',
						value: `**Onderwerp:** ${interaction.fields.getTextInputValue('ticket-about')}\n` +
							   `**Beschrijving:** ${interaction.fields.getTextInputValue('ticket-description')}`
					});
					const evidence = interaction.fields.getTextInputValue('ticket-evidence');
					if (evidence) {
						embed.addFields({
							name: '🔍 Bewijs',
							value: evidence
						});
					}
					const resolution = interaction.fields.getTextInputValue('ticket-resolution');
					if (resolution) {
						embed.addFields({
							name: '💡 Gewenste Oplossing',
							value: resolution
						});
					}
				}
				
				// Send ticket to channel
				await interaction.channel.send({
					content: '🎫 **Nieuw ticket ontvangen!** Staff members zullen zo snel mogelijk reageren.',
					embeds: [embed]
				});
				
				// Confirm to user
				await interaction.reply({
					content: `✅ Je ${getTicketTitle(ticketType).toLowerCase()} ticket is succesvol ingediend! Onze staff zal zo snel mogelijk reageren.`,
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