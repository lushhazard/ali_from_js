const { SlashCommandBuilder } = require('discord.js');
const GameDetails = require('../../models/gameDetailsSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startgame')
        .setDescription('Start a timer for a game in this server.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The name of the game')
                .setRequired(true)),

    async execute(interaction) {
        const gameName = interaction.options.getString('game').toLowerCase();
        const guildId = interaction.guild.id;

        const gameDetails = await GameDetails.findOne({ guildId, gameName });

        if (!gameDetails) {
            return interaction.reply({
                content: `The game \`${gameName}\` is not registered yet my friend. Please register it first.`,
            });
        }

        if (gameDetails.currentlyActive) {
            return interaction.reply({
                content: `A \`${gameName}\` game is already in progress!`,
            });
        }

        // Update game details in the database
        gameDetails.currentlyActive = true;
        gameDetails.gameTime = new Date();
        await gameDetails.save();

        return interaction.reply(`My pocket watch is ticking.`);
    },
};
