const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = '!';

client.on('messageCreate', async (message) => {
    // Voorkom dat de bot op zichzelf reageert of berichten zonder prefix negeert
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ghostmessage') {
        const ghostText = args.join(' ');

        if (!ghostText) {
            return message.reply("The ghost has nothing to say... (Please provide a message).");
        }

        // 1. Verwijder het bericht van de gebruiker direct
        try {
            await message.delete();
        } catch (err) {
            console.error("Kon bericht niet verwijderen:", err);
        }

        // 2. Verstuur het bericht als 'The Ghost'
        // We gebruiken een Embed om het een bovennatuurlijk tintje te geven
        const ghostEmbed = new EmbedBuilder()
            .setColor('#f0f0f0') // Spookachtig wit/grijs
            .setAuthor({ name: 'A Restless Spirit', iconURL: 'https://i.imgur.com/8vM87Y4.png' }) // Gebruik een ghost icon
            .setDescription(`*"${ghostText}"*`)
            .setFooter({ text: 'Sent from the afterlife...' });

        await message.channel.send({ embeds: [ghostEmbed] });
    }
});

client.login('JOUW_BOT_TOKEN_HIER');
