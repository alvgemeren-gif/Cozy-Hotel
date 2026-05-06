# Welcome & Goodbye Commands Guide

## Overview
I've created two separate commands for welcome and goodbye messages that automatically send messages when members join or leave your server.

## Commands

### 1. `/setwelcome`
- **Description**: Set up welcome messages for new members
- **Permissions**: Manage Server (ManageGuild)
- **Parameters**:
  - `channel` (required): The channel where welcome messages will be sent
  - `message` (optional): Custom welcome message

**Default welcome message:**
```
🎉 Welkom {user} op **{server}**! We zijn blij je hier te hebben! 🎉
```

**Example usage:**
```
/setwelcome channel:#welcome
/setwelcome channel:#welcome message:"Hallo {user}, welkom op {server}! Je bent member #{membercount}!"
```

### 2. `/setgoodbye`
- **Description**: Set up goodbye messages for members who leave
- **Permissions**: Manage Server (ManageGuild)
- **Parameters**:
  - `channel` (required): The channel where goodbye messages will be sent
  - `message` (optional): Custom goodbye message

**Default goodbye message:**
```
👋 **{user}** has left **{server}**. We will miss them! 😢
```

**Example usage:**
```
/setgoodbye channel:#goodbye
/setgoodbye channel:#goodbye message:"{user} is vertrokken van {server}. Tot ziens!"
```

## Variables
You can use these variables in your custom messages:

| Variable | Description | Example |
|----------|-------------|---------|
| `{user}` | Mention/tag of the user | `<@123456789>` or `Username#1234` |
| `{server}` | Name of the server | `My Awesome Server` |
| `{membercount}` | Total number of members | `1234` |

## How It Works

1. **Setup**: Use `/setwelcome` and `/setgoodbye` to configure the channels and custom messages
2. **Automatic**: Once configured, the bot automatically sends messages when:
   - A new member joins the server (welcome)
   - A member leaves or is kicked (goodbye)
3. **Per-Server**: Settings are stored per server, so you can have different configurations for different servers

## Important Notes

1. **Bot Permissions**: The bot needs:
   - `GuildMembers` intent (already enabled)
   - Permission to send messages in the configured channels
   - `ManageGuild` permission for users to use the setup commands

2. **Settings Storage**: Settings are stored in memory and will reset when the bot restarts. For persistent storage, you would need to implement a database.

3. **Channel Deletion**: If the configured channel is deleted, the bot will log a warning but continue running. Use the commands again to set a new channel.

4. **Separate Commands**: Welcome and goodbye messages are completely separate - you can enable one without the other, and they can use different channels.

## Files Created

1. **`commands/welcome/welcome.js`** - Welcome command and handler
2. **`commands/goodbye/goodbye.js`** - Goodbye command and handler
3. **`app.js`** - Updated to handle `GuildMemberAdd` and `GuildMemberRemove` events

## Usage Examples

### Setting up welcome messages:
```
/setwelcome channel:#welcomes
```
This will use the default welcome message.

### Setting up custom welcome:
```
/setwelcome channel:#welcomes message:"🎊 Hey {user}! Welkom op {server}! We zijn nu met {membercount} members! 🎊"
```

### Setting up goodbye messages:
```
/setgoodbye channel:#logs message:"😔 {user} is helaas vertrokken van {server}. We wensen hen het beste!"
```

### Disabling messages:
To disable welcome or goodbye messages, you would need to restart the bot (since settings are in-memory). For a permanent disable command, you could add a `/removewelcome` and `/removegoodbye` command in the future.

## Future Enhancements

Possible improvements:
- Add `/removewelcome` and `/removegoodbye` commands to disable messages
- Add persistent storage (database) for settings
- Add more customization options (embeds, images, etc.)
- Add different messages for different types of leaves (kick vs leave)
- Add welcome DM messages
- Add verification system before sending welcome