const { SlashCommandBuilder } = require('discord.js');
let gameTimers = {}; // In-memory object to store ongoing game timers for each server

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

        // Check if a game is already running for this server and game
        if (gameTimers[guildId] && gameTimers[guildId][gameName]) {
            return interaction.reply(`A \`${gameName}\` game is already in progress!`);
        }

        if (!gameTimers[guildId]) {
            gameTimers[guildId] = {};
        }

        gameTimers[guildId][gameName] = {
            startTime: Date.now(),
        };

        return interaction.reply(`My pocket watch is ticking.`);
    },
};
