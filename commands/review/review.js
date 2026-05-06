const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('review')
		.setDescription('Share a review for books, recipes, or drinks'),
	
	async execute(interaction) {
		// Create the selection menu for review types
		const row = new ActionRowBuilder()
			.addComponents(
				new StringSelectMenuBuilder()
					.setCustomId('review-type')
					.setPlaceholder('Select a review type...')
					.addOptions([
						{
							label: '📚 Books',
							description: 'Review a book',
							value: 'books',
						},
						{
							label: '🍳 Recipes',
							description: 'Review a recipe',
							value: 'recipes',
						},
						{
							label: '🍹 Drinks',
							description: 'Review a drink',
							value: 'drinks',
						},
					]),
			);

		const response = await interaction.reply({
			content: 'What type of review would you like to share?',
			components: [row],
			ephemeral: true,
		});

		// Wait for the user to select a review type
		const collectorFilter = i => i.user.id === interaction.user.id;

		try {
			const confirmation = await response.awaitMessageComponent({
				filter: collectorFilter,
				componentType: ComponentType.StringSelect,
				time: 60000, // 60 seconds timeout
			});

			const selectedType = confirmation.values[0];

			// Create and show the appropriate modal based on selection
			let modal;

			if (selectedType === 'books') {
				modal = new ModalBuilder()
					.setCustomId('review-modal-books')
					.setTitle('Book Review');

				const titleInput = new TextInputBuilder()
					.setCustomId('book-title')
					.setLabel('Book Title')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter the title of the book')
					.setRequired(true);

				const authorInput = new TextInputBuilder()
					.setCustomId('book-author')
					.setLabel('Author')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter the author\'s name')
					.setRequired(true);

				const starsInput = new TextInputBuilder()
					.setCustomId('book-stars')
					.setLabel('Rating (1-5 stars)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter a number from 1 to 5')
					.setRequired(true)
					.setMaxLength(1);

				const firstRow = new ActionRowBuilder().addComponents(titleInput);
				const secondRow = new ActionRowBuilder().addComponents(authorInput);
				const thirdRow = new ActionRowBuilder().addComponents(starsInput);

				modal.addComponents(firstRow, secondRow, thirdRow);

			} else if (selectedType === 'recipes') {
				modal = new ModalBuilder()
					.setCustomId('review-modal-recipes')
					.setTitle('Recipe Review');

				const titleInput = new TextInputBuilder()
					.setCustomId('recipe-title')
					.setLabel('Recipe Title')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter the name of the recipe')
					.setRequired(true);

				const linkInput = new TextInputBuilder()
					.setCustomId('recipe-link')
					.setLabel('Recipe Link (URL)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('https://example.com/recipe')
					.setRequired(true);

				const starsInput = new TextInputBuilder()
					.setCustomId('recipe-stars')
					.setLabel('Rating (1-5 stars)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter a number from 1 to 5')
					.setRequired(true)
					.setMaxLength(1);

				const categoriesInput = new TextInputBuilder()
					.setCustomId('recipe-categories')
					.setLabel('Categories')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('e.g., dinner, lunch, breakfast, pasta, meat, vegetarian')
					.setRequired(true);

				const firstRow = new ActionRowBuilder().addComponents(titleInput);
				const secondRow = new ActionRowBuilder().addComponents(linkInput);
				const thirdRow = new ActionRowBuilder().addComponents(starsInput);
				const fourthRow = new ActionRowBuilder().addComponents(categoriesInput);

				modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

			} else if (selectedType === 'drinks') {
				modal = new ModalBuilder()
					.setCustomId('review-modal-drinks')
					.setTitle('Drink Review');

				const titleInput = new TextInputBuilder()
					.setCustomId('drink-title')
					.setLabel('Drink Name')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter the name of the drink')
					.setRequired(true);

				const linkInput = new TextInputBuilder()
					.setCustomId('drink-link')
					.setLabel('Recipe/Info Link (URL)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('https://example.com/drink')
					.setRequired(true);

				const starsInput = new TextInputBuilder()
					.setCustomId('drink-stars')
					.setLabel('Rating (1-5 stars)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Enter a number from 1 to 5')
					.setRequired(true)
					.setMaxLength(1);

				const categoriesInput = new TextInputBuilder()
					.setCustomId('drink-categories')
					.setLabel('Categories')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('e.g., tea, coffee, cocktail')
					.setRequired(true);

				const firstRow = new ActionRowBuilder().addComponents(titleInput);
				const secondRow = new ActionRowBuilder().addComponents(linkInput);
				const thirdRow = new ActionRowBuilder().addComponents(starsInput);
				const fourthRow = new ActionRowBuilder().addComponents(categoriesInput);

				modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
			}

			await confirmation.showModal(modal);

		} catch (error) {
			if (error.code === 'InteractionCollectorError') {
				await interaction.editReply({
					content: 'Selection timed out. Please use the /review command again.',
					components: [],
				});
			} else {
				console.error(error);
				await interaction.editReply({
					content: 'There was an error processing your request.',
					components: [],
				});
			}
		}
	}
};