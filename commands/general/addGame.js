const { SlashCommandBuilder } = require('discord.js');
const GameDetails = require('../../models/gameDetailsSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addgame')
        .setDescription('Add a game with details to track.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The name of the game to add')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winthreshold')
                .setDescription('Lowest rank counted as winner')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('maxplayers')
                .setDescription('Maximum number of players')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('minplayers')
                .setDescription('Minimum number of players')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Optional description for the game')
                .setRequired(false)),

    async execute(interaction) {
        const gameName = interaction.options.getString('game').toLowerCase();
        const maxPlayers = interaction.options.getInteger('maxplayers');
        const minPlayers = interaction.options.getInteger('minplayers');
        const winThreshold = interaction.options.getInteger('winthreshold');
        const description = interaction.options.getString('description') || '';
        const guildId = interaction.guild.id;

        try {
            // Check if game already exists in the database
            let gameDetails = await GameDetails.findOne({ guildId, gameName });

            if (gameDetails) {
                return interaction.reply(`Im afraid \`${gameName}\` is already registered here my friend.`);
            }

            // Create a new game entry with the provided details
            gameDetails = new GameDetails({
                guildId,
                gameName,
                maxPlayers,
                minPlayers,
                winThreshold,
                description,
            });

            // Save the new game to the database
            await gameDetails.save();

            // Reply with success message
            interaction.reply(
                `Game \`${gameName}\` has been added with max:\`${maxPlayers}\`, min: \`${minPlayers}\` players and win threshold \`${winThreshold}\`. When are we playing?!`);
        } catch (error) {
            console.error(error);

            // Handle the MongoDB duplicate error
            if (error.code === 11000) {
                return interaction.reply(`Im afraid that game is already registered here my friend.`);
            }

            // Handle any unexpected errors
            interaction.reply('An... error occurred while trying to add the game. Ali apologizes for this inconvenience.');
        }
    }
};
