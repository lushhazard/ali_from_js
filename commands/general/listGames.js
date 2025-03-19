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
            return interaction.reply('No games are currently being tracked in this server.');
        }

        // Format the list of games to show in a readable way
        const gameList = games.map(game => `**${game.gameName}** - Max Players: ${game.maxPlayers}, Winners: ${game.numWinners}`).join('\n');

        // Send the list of games as a reply
        interaction.reply(`Games being tracked in this server:\n${gameList}`);
    }
};
