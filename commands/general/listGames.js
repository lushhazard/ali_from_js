const { SlashCommandBuilder } = require('discord.js');
const GameDetails = require('../../models/gameDetailsSchema'); // Import the updated game details schema

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listgames')
        .setDescription('Shows all the games currently tracked in this server.'),

    async execute(interaction) {
        const guildId = interaction.guild.id; // Get the guild ID (server ID)

        // Fetch all games tracked in this guild from the database
        const games = await GameDetails.find({ guildId });

        // If there are no games tracked, reply with a message
        if (games.length === 0) {
            return interaction.reply(`My friend, this bazaar is barren. Add some games for me to track, will you?`);
        }

        // monstrous formatting just to have them start with capital letters
        const gameList = games.map(game => `- **${game.gameName.charAt(0).toUpperCase() + game.gameName.slice(1)}** - ${game.description}`).join('\n');

        // Send the list of games as a reply
        interaction.reply(`In this bazaar, Ali is tracking:\n${gameList}`);
    }
};
