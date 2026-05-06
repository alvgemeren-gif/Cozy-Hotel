# Casino Commands Guide

## Overview
I've created a complete casino/economy system with 5 commands for your Discord bot. The commands are grouped under `/casino economy` subcommands.

## Commands

### 1. `/casino economy work`
- **Description**: Work to earn coins
- **Cooldown**: 5 minutes
- **Earnings**: Random amount based on job type (10-300 coins)
- **Jobs available**: Street Cleaner, Delivery Person, Line Cook, Freelance Writer, Web Developer, Construction Worker, Nurse, Teacher, Lawyer, CEO

### 2. `/casino economy balance`
- **Description**: Check your coin balance
- **Optional**: You can check another user's balance by mentioning them
- **Example**: `/casino economy balance user:@Username`

### 3. `/casino economy gamble <amount>`
- **Description**: Play a slot machine game
- **Parameters**: 
  - `amount`: Number of coins to bet (must be positive)
- **Win conditions**:
  - 3 matching symbols: Big win (3x-10x bet)
  - 2 matching symbols: Small win (1.5x bet)
  - No match: Lose bet
- **Special**: 7️⃣7️⃣7️⃣ = Jackpot (10x bet)!

### 4. `/casino economy coinflip <amount> <choice>`
- **Description**: Flip a coin and double your money or lose it
- **Parameters**:
  - `amount`: Number of coins to bet (must be positive)
  - `choice`: Choose "heads" or "tails"
- **Win**: Double your bet (get bet back + same amount)
- **Lose**: Lose your entire bet

### 5. `/casino economy steal <target>`
- **Description**: Try to steal coins from another user
- **Parameters**:
  - `target`: The user to steal from
- **Success rate**: 60% chance
- **Steal amount**: 10-50% of target's balance
- **Cooldown**: 30 minutes
- **Failure**: If caught, you lose 50% of the attempted steal amount as penalty
- **Restrictions**: Can't steal from yourself or bots

## How It Works

### Economy System
- Each user has their own balance stored in memory
- Balances persist until the bot restarts (for permanent storage, you'd need a database)
- All transactions are tracked and updated in real-time

### Cooldowns
- **Work**: 5 minutes between each work session
- **Steal**: 30 minutes between each steal attempt
- Cooldowns are tracked per user

### Game Mechanics
- **Work**: Random job selection with varying pay ranges
- **Gamble**: Slot machine with 6 different symbols
- **Coinflip**: 50/50 chance, completely random
- **Steal**: Success based on luck, with consequences for failure

## Usage Examples

```
/casino economy work
/casino economy balance
/casino economy balance user:@Friend
/casino economy gamble 100
/casino economy coinflip 50 heads
/casino economy steal @RichUser
```

## Important Notes

1. **Memory Storage**: Balances are stored in memory, so they will reset when the bot restarts. For persistent storage, you would need to implement a database.

2. **Starting Balance**: Users start with 0 coins. They need to use `/casino economy work` first to earn money before they can gamble or flip coins.

3. **Negative Balance Protection**: The system prevents balances from going below 0.

4. **Bot Permissions**: The bot needs permission to send messages and use slash commands in the channels where users want to play.

## Integration with Minigames

The casino system is separate from the minigames system but uses the same command loading structure. Both systems now properly export their helper functions and state maps for use in `app.js`.

## Files Modified/Created

1. **Created**: `commands/casino/casino.js` - All casino command logic
2. **Modified**: `app.js` - Added imports for casino module and shared state maps
3. **Fixed**: `commands/minigames/minigames.js` - Exported helper functions for button handlers
4. **Fixed**: `app.js` - Properly imported minigames helper functions and fixed Wordle button handler

## Troubleshooting

If commands don't appear:
1. Make sure the bot has been restarted after adding the new files
2. Run the deploy script to register the new slash commands
3. Check that the bot has proper permissions in the server

If balances don't persist:
- This is expected behavior with in-memory storage
- Balances will reset on bot restart
- Consider implementing a database for persistent storage

## Future Enhancements

Possible improvements:
- Add a `/casino economy daily` command for daily rewards
- Implement a leaderboard system
- Add more gambling games (blackjack, roulette, etc.)
- Create a shop system to spend coins
- Add achievements and statistics
- Implement persistent database storage