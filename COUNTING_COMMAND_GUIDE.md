# Counting Game Command Guide

## Overview
The `/startcounting` command creates a collaborative counting game where users take turns counting up from 1. If someone makes a mistake, the counting continues from the correct number.

## How to Use

### 1. Start the Game
Type `/startcounting` in any channel where you want to play.

### 2. Game Rules
- Users take turns counting up from 1 (1, 2, 3, 4, 5, ...)
- Each person can only say the **next number** in sequence
- The same person cannot count twice in a row
- If someone makes a mistake, the counting **continues** from the correct number (no reset!)
- Try to reach high numbers together as a community!

### 3. How to Play
1. After starting with `/startcounting`, a message will appear showing the current count
2. Type the next number (starting with **1**)
3. Wait for someone else to type the next number
4. Continue taking turns counting up

### 4. Special Features
- **Milestone Celebrations:** Every 50 numbers (50, 100, 150, etc.), the bot will celebrate!
- **Mistake Handling:** If someone types the wrong number, the bot will show what the correct number was, and the game continues
- **Turn Enforcement:** If someone tries to count twice in a row, their message will be deleted

## Examples

### Starting the Game
```
User: /startcounting
Bot: 🎯 **Counting game has started!** Type the next number to begin!
```

### Normal Gameplay
```
User1: 1
Bot: 🎯 **Counting:** 1
User2: 2
Bot: 🎯 **Counting:** 2
User3: 3
Bot: 🎯 **Counting:** 3
```

### Mistake Handling
```
User1: 3
User2: 5  (wrong! should be 4)
Bot: ❌ User2 said **5** but the correct number was **4**!
     The counting continues from **4**!
User3: 4
Bot: 🎯 **Counting:** 4
```

### Milestone Celebration
```
User: 50
Bot: 🎯 **Counting:** 50
Bot: 🎉 Milestone Reached! 50!
     User helped reach 50!
```

## Technical Details

### Files Created/Modified:
- `commands/counting/counting.js` - Main command file
- `app.js` - Added message handler for counting game

### Command Structure:
- **Command Name:** `/startcounting`
- **Description:** Start a counting game in this channel
- **Permissions:** Manage Channels (to prevent everyone from starting games)

### Game State:
- One game per guild (server)
- Game state stored in memory (resets if bot restarts)
- Tracks: current count, last counter, channel ID

### Features:
- ✅ Automatic number validation
- ✅ Turn-based system (no duplicate counters)
- ✅ Mistake detection and continuation
- ✅ Milestone celebrations (every 50 numbers)
- ✅ Real-time score updates
- ✅ Visual embeds with current count and instructions

## Stopping the Game

To stop a counting game, you can:
1. Restart the bot (game state will be cleared)
2. Start a new game in a different channel (the old game will be replaced)

## Notes
- Only one counting game can run per server at a time
- The game continues indefinitely until stopped
- Bot needs permission to:
  - Send messages in the counting channel
  - Edit its own messages (to update the count)
  - Delete messages (to remove invalid counts)
- Game state is stored in memory and will reset if the bot restarts

## Common Issues

### "A counting game is already running"
- A game is already active in another channel
- Use `/startcounting` again to see which channel has the active game
- Or start a new game to replace the old one

### Messages not being counted
- Make sure you're typing just a number (e.g., "5" not "five" or "5!")
- The bot ignores non-numeric messages
- The same person cannot count twice in a row

### Game stopped working
- The bot may have restarted, clearing the game state
- Simply use `/startcounting` again to begin a new game

## Future Enhancement Ideas
- Add a `/stopcounting` command to manually end games
- Store high scores in a database
- Add counting statistics (average speed, mistakes, etc.)
- Add different game modes (counting backwards, by 2s, etc.)
- Add achievements for reaching milestones
- Add a leaderboard for most contributions