# Review Command Guide

## Overview
The `/review` command allows users to share reviews for books, recipes, and drinks. When users run the command, they'll be presented with a dropdown menu to select the type of review they want to submit.

## How to Use

### 1. Run the Command
Type `/review` in any channel where the bot is active.

### 2. Select Review Type
You'll see a dropdown menu with three options:
- 📚 **Books** - Review a book
- 🍳 **Recipes** - Review a recipe
- 🍹 **Drinks** - Review a drink

### 3. Fill Out the Form
Based on your selection, a modal will appear with the appropriate fields:

#### 📚 Books Review
- **Book Title** - The title of the book
- **Author** - The author's name
- **Rating (1-5 stars)** - Enter a number from 1 to 5

#### 🍳 Recipes Review
- **Recipe Title** - The name of the recipe
- **Recipe Link (URL)** - A link to the recipe
- **Rating (1-5 stars)** - Enter a number from 1 to 5
- **Categories** - e.g., dinner, lunch, breakfast, pasta, meat, vegetarian

#### 🍹 Drinks Review
- **Drink Name** - The name of the drink
- **Recipe/Info Link (URL)** - A link to the drink recipe or information
- **Rating (1-5 stars)** - Enter a number from 1 to 5
- **Categories** - e.g., tea, coffee, cocktail

### 4. Submit
Click the "Submit" button to send your review.

## Technical Details

### Command Structure
- **Command Name:** `/review`
- **Description:** Share a review for books, recipes, or drinks
- **Permissions:** None required (anyone can use)

### Files Created
- `commands/review/review.js` - Main command file

### Features
- ✅ Dropdown menu for selecting review type
- ✅ Dynamic modal forms based on selection
- ✅ 60-second timeout for selection
- ✅ User-specific interaction (only the command user can interact)
- ✅ Error handling for timeouts and other issues
- ✅ Ephemeral responses (only visible to the user)

## Deployment

After adding the command file, you need to restart the bot for the command to be registered. The command will be automatically deployed through the existing `deployCommands()` function in `app.js`.

### Steps:
1. Make sure the bot has the latest code
2. Restart the bot: `npm start` or `node app.js`
3. The command will be automatically registered with Discord

## Notes
- The command is ephemeral (only visible to the user who ran it)
- If the user doesn't select a review type within 60 seconds, the interaction will time out
- All form fields are required
- The rating field only accepts single digits (1-5)

## Future Enhancements (Optional)
If you want to expand this command in the future, you could:
- Add a channel option to post reviews to a specific channel
- Add more review categories
- Store reviews in a database
- Add edit/delete functionality for reviews
- Add a command to view all reviews
- Add optional fields (like comments or descriptions)