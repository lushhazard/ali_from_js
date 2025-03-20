const { SlashCommandBuilder } = require('discord.js');
const GameDetails = require('../../models/gameDetailsSchema'); // Import game details schema

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timers')
        .setDescription('Check the timers of all ongoing games in this server.'),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Fetch all active games for this server
        const ongoingGames = await GameDetails.find({ guildId, currentlyActive: true });

        if (ongoingGames.length === 0) {
            return interaction.reply('No games are currently running in this server.');
        }

        let response = '⏳ **Ongoing Games:**\n';
        ongoingGames.forEach(game => {
            // make it fit discords expected precision
            const startTime = Math.floor(game.gameTime / 1000);

            response += `**${game.gameName}** - Started <t:${startTime}:R>\n`;
        });

        await interaction.reply(response);
    },
};
