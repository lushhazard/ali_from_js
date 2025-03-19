const { ActionRowBuilder, UserSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');
const GameLog = require('../../models/gameLogSchema');
const GameDetails = require('../../models/gameDetailsSchema');
const getGameModel = require('../../models/scoreboardSchema'); // The dynamically created game model

const gameTimers = {}; // also initialized in startGame.js

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finishgame')
        .setDescription('Finish a game and register the victors and players')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game that was played')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('time')
                .setDescription('Duration of the game in minutes')
                .setRequired(false) // Time... is optional!
        ),

    async execute(interaction) {
        const gameName = interaction.options.getString('game');

        const gameDetails = await GameDetails.findOne({ guildId, gameName });

        if (!gameDetails) {
            return interaction.reply({
                content: `The game \`${gameName}\` is not registered yet. Please register it first using the appropriate command.`,
            });
        }

        const providedTime = interaction.options.getInteger('time');
        const guildId = interaction.guild.id;
        let gameTime = providedTime;

        if (!gameTime && gameTimers[guildId] && gameTimers[guildId][gameName]) {
            const gameStartTime = gameTimers[guildId][gameName].startTime;
            // convert milliseconds to minutes
            gameTime = Math.floor((Date.now() - gameStartTime) / 60000);
        }

        // optionally, ask the user for the game time
        if (!gameTime) {
            delete gameTimers[guildId][gameName];
            return await interaction.reply({
                content: 'Please remember to provide the game duration my friend. (in minutes)',
            });
        }

        // if time is already available, proceed with the game results
        await handleGameFinish(interaction, gameName, gameTime);

        delete gameTimers[guildId][gameName];
    },
};

async function handleGameFinish(interaction, gameName, gameTime) {
    const victorsSelect = new UserSelectMenuBuilder()
        .setCustomId('victors')
        .setPlaceholder('Select the victors')
        .setMinValues(1)
        .setMaxValues(10);

    const playersSelect = new UserSelectMenuBuilder()
        .setCustomId('players')
        .setPlaceholder('Select all players')
        .setMinValues(1)
        .setMaxValues(10);

    // Create an action row for each menu
    const row1 = new ActionRowBuilder().addComponents(victorsSelect);
    const row2 = new ActionRowBuilder().addComponents(playersSelect);

    await interaction.reply({
        content: 'Please select the victors and players for this game:',
        components: [row1, row2],
    });

    // Set up a collector to handle the user's selections
    const collector = interaction.channel.createMessageComponentCollector({
        componentType: 'USER_SELECT_MENU',
        time: 60000, // 1-minute timeout for selection
    });

    let victors = [];
    let players = [];

    collector.on('collect', async (collectedInteraction) => {
        if (collectedInteraction.customId === 'victors') {
            victors = collectedInteraction.values; // store selected victor user ids
            await collectedInteraction.update({
                content: 'Victors selected: ' + victors.join(', '),
                components: [],
            });
            console.log('Selected victors:', victors);
        }

        if (collectedInteraction.customId === 'players') {
            players = collectedInteraction.values; // store selected player user ids
            await collectedInteraction.update({
                content: 'Players selected: ' + players.join(', '),
                components: [],
            });
            console.log('Selected players:', players);

            const losers = players.filter(playerId => !victors.includes(playerId));

            await registerGameResults(victors, losers, interaction.guild.id, gameName, gameTime);

            // Stop the collector after processing the game results
            collector.stop();
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            interaction.followUp({
                content: 'You took too long to select players. Please try again.',
                components: [],
            });
        }
    });
}

async function registerGameResults(victors, losers, guildId, gameName, gameTime) {
    // save game log with winners, losers, game duration
    const gameLog = new GameLog({
        guildId,
        gameName,
        victors, // List of victor user IDs
        losers,  // List of loser user IDs
        gameTime, // Game duration in minutes
        timestamp: Date.now(),
    });

    try {
        await gameLog.save(); // Save the game log
        console.log('Game results saved!');

        // Now update the scoreboard for all players (both winners and losers)
        await updateScoreboard(victors, losers, guildId, gameName);
    } catch (error) {
        console.error('Error saving game results:', error);
    }
}
// function to update the scoreboard for the selected players
async function updateScoreboard(victors, losers, guildId, gameName) {
    const allPlayers = [...victors, ...losers]; // Combine winners and losers into all players

    // Dynamically get the game model based on guildId and gameName
    const GameModel = getGameModel(guildId, gameName);

    for (const playerId of allPlayers) {
        // Check if a scoreboard entry exists for this player in this game
        let playerStats = await GameModel.findOne({ playerId });

        if (!playerStats) {
            // If no entry, create a new one
            playerStats = new GameModel({
                playerId,
                playerName: '', // Placeholder, can be updated later
                gamesWon: 0,
                gamesPlayed: 0,
            });
        }

        // Increment games played
        playerStats.gamesPlayed++;

        // If the player is a victor, increment their games won
        if (victors.includes(playerId)) {
            playerStats.gamesWon++;
        }

        // Save the updated player stats
        await playerStats.save();
    }

    console.log('Scoreboard updated!');
}
