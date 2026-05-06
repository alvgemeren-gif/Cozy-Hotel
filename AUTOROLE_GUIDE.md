# Autorole Command Guide

## Overview
The autorole command automatically assigns a role to new members when they join your server. This is perfect for giving everyone a basic "Member" role or any other role you want to automatically assign.

## Command

### `/autorole`
- **Description**: Manage automatic role assignment for new members
- **Permissions**: Manage Server (ManageGuild)
- **Subcommands**:
  - `set` - Set the role that new members will automatically receive
  - `remove` - Remove the automatic role assignment
  - `show` - Show the current autorole setting

## Usage

### Setting up autorole:
```
/autorole set role:@Member
```
This will automatically give the @Member role to all new members who join the server.

### Checking current setting:
```
/autorole show
```
Shows which role is currently set for autorole.

### Removing autorole:
```
/autorole remove
```
Disables automatic role assignment.

## How It Works

1. **Setup**: Use `/autorole set` to select a role
2. **Automatic Assignment**: When a new member joins, the bot automatically adds the role
3. **Permissions Check**: The bot checks that it can manage the role (role must be lower than bot's highest role)
4. **Integration**: Works alongside welcome messages - both can be enabled simultaneously

## Important Notes

### Bot Permissions Required:
- **Manage Roles**: The bot needs permission to assign roles
- **Role Hierarchy**: The autorole must be lower than the bot's highest role
- **Role Editable**: The role must be manageable by the bot (not owned by a higher user)

### Role Requirements:
- The role must exist and be selectable
- The role must be lower in the hierarchy than the bot's highest role
- If the role is deleted, the autorole setting will be automatically cleared

### Settings Storage:
- Settings are stored per server (guild)
- Settings are stored in memory and will reset when the bot restarts
- For persistent storage, you would need to implement a database

## Example Use Cases

### Basic Member Role:
```
/autorole set role:@Member
```
Gives all new members a basic "Member" role.

### Verified Role:
```
/autorole set role:@Verified
```
Automatically marks all new members as "Verified".

### Multiple Roles:
Currently, only one role can be set. If you need multiple roles, you would need to modify the command or use multiple bots.

## Error Handling

The command includes several safety checks:

1. **Role Too High**: If you try to set a role that's higher than the bot's highest role, it will refuse and explain why.

2. **Role Not Editable**: If the role is managed by someone with higher permissions, the bot will let you know.

3. **Role Deleted**: If the autorole role is deleted, the bot will automatically clean up the setting and warn you.

4. **No Permission**: If the bot loses the "Manage Roles" permission, it won't be able to assign the role.

## Integration with Other Features

The autorole works seamlessly with:
- **Welcome Messages**: Both can be enabled - autorole assigns the role, welcome sends a message
- **Goodbye Messages**: No conflict - goodbye messages work independently
- **Other Commands**: No interference with casino, counting, or other commands

## Files Created

1. **`commands/autorole/autorole.js`** - Autorole command with set/remove/show subcommands
2. **`app.js`** - Updated to call `assignAutorole()` when members join

## Future Enhancements

Possible improvements:
- Add support for multiple autoroles
- Add delay before assigning role (to prevent raids)
- Add different roles for different conditions (e.g., after verification)
- Add persistent storage (database)
- Add `/autorole list` to show all configured autoroles
- Add bypass options for certain users/roles