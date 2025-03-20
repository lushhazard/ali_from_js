const { ActionRowBuilder, UserSelectMenuBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GameLog = require('../../models/gameLogSchema');
const GameDetails = require('../../models/gameDetailsSchema');
const getGameModel = require('../../models/scoreboardSchema'); // The dynamically created game model

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
        const guildId = interaction.guild.id;
        const gameName = interaction.options.getString('game').toLowerCase();
        const gameDetails = await GameDetails.findOne({ guildId, gameName });

        if (!gameDetails) {
            return interaction.reply({
                content: `The game \`${gameName}\` is not registered yet my friend. Please register it first.`,
            });
        }

        const providedTime = interaction.options.getInteger('time');
        let gameTime = providedTime;

        if (!gameTime && gameDetails.currentlyActive) {
            const gameStartTime = gameDetails.gameTime;
            // convert milliseconds to minutes
            gameTime = Math.floor((Date.now() - gameStartTime) / 60000);
        }

        // optionally, ask the user for the game time
        if (!gameTime) {
            return await interaction.reply({
                content: 'Please remember to provide the game duration my friend. (in minutes)',
            });
        }

        // if time is already available, proceed with the game results
        await handleGameFinish(interaction, gameName, gameTime);

        gameDetails.currentlyActive = false;
        await gameDetails.save();
    },
};

async function handleGameFinish(interaction, gameName, gameTime) {
    const victorsSelect = new UserSelectMenuBuilder()
        .setCustomId('victors')
        .setPlaceholder('Select the victors')
        .setMinValues(1)
        .setMaxValues(10);

    const playersSelect = new UserSelectMenuBuilder()
        .setCustomId('losers')
        .setPlaceholder('Select the losers')
        .setMinValues(1)
        .setMaxValues(10);

    const doneButton = new ButtonBuilder()
        .setCustomId('done')
        .setLabel('Done')
        .setStyle(ButtonStyle.Success);

    // Create action rows for UI
    const row1 = new ActionRowBuilder().addComponents(victorsSelect);
    const row2 = new ActionRowBuilder().addComponents(playersSelect);
    const row3 = new ActionRowBuilder().addComponents(doneButton);

    const collectorFilter = i => i.user.id === interaction.user.id;

    await interaction.reply({
        filter: collectorFilter,
        content: 'Please select the victors and losers for this game, then press **Done**.',
        components: [row1, row2, row3],
    });

    // Collector to handle user interactions
    const collector = interaction.channel.createMessageComponentCollector({
        time: 60000, // 1-minute timeout
    });

    let victors = [];
    let losers = [];

    collector.on('collect', async (collectedInteraction) => {
        const { customId, values, user } = collectedInteraction;

        if (customId === 'victors') {
            victors = values;
            await collectedInteraction.update({
                content: `✔ **Victors selected:** ${victors.map(v => `<@${v}>`).join(', ')}`,
                components: [row1, row2, row3], // Keep players & Done button
            });
        }

        else if (customId === 'losers') {
            losers = values;
            await collectedInteraction.update({
                content: `✔ **Losers selected:** ${losers.map(p => `<@${p}>`).join(', ')}`,
                components: [row1, row2, row3], // Keep victors & Done button
            });
        }

        else if (customId === 'done') {
            if (!victors.length || !losers.length) {
                return collectedInteraction.reply({ content: '❌ Please select both victors and losers before finishing!', flags: MessageFlags.Ephemeral });
            }

            losers = losers.filter(playerId => !victors.includes(playerId));

            await registerGameResults(victors, losers, interaction, gameName, gameTime);
            await updateScoreboard(victors, losers, interaction, gameName);

            await collectedInteraction.update({
                content: `🎉 **Game results saved!**\n🏆 **Winners:** ${victors.map(v => `<@${v}>`).join(', ')}\n🎮 **Losers:** ${losers.map(l => `<@${l}>`).join(', ')}`,
                components: [],
            });

            collector.stop();
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            interaction.followUp({ content: '⏳ You took too long! Try again.', components: [] });
        }
    });
}

async function registerGameResults(victors, losers, interaction, gameName, gameTime) {
    try {
        if (!gameTime) {
            throw new Error('Game duration is missing.');
        }
        guildId = interaction.guild.id
        console.log(guildId);
        // Fetch user details from Discord API (to get usernames)
        const winnerDetails = victors.map(userId => {
            const user = interaction.guild.members.cache.get(userId);
            return {
                playerId: String(userId),
                playerName: user ? user.user.username : 'Unknown',
            };
        });
        const loserDetails = losers.map(userId => {
            const user = interaction.guild.members.cache.get(userId);
            return {
                playerId: String(userId),
                playerName: user ? user.user.username : 'Unknown',
            };
        });
        const gameLog = new GameLog({
            guildId,
            gameName,
            winners: winnerDetails,
            losers: loserDetails,
            gameDuration: gameTime,
            timestamp: new Date(),
        });
        await gameLog.save();
        console.log(`Game results saved for ${gameName} in ${guildId}`);
    } catch (error) {
        console.error('Error saving game results:', error);
    }
}

async function updateScoreboard(victors, losers, interaction, gameName) {
    const allPlayers = [...victors, ...losers]; // Combine winners and losers into all players

    guildId = interaction.guild.id

    const GameModel = getGameModel(guildId, gameName);

    for (const playerId of allPlayers) {

        playerName = interaction.guild.members.cache.get(playerId);
        // check if a scoreboard entry exists for this player in this game
        let playerStats = await GameModel.findOne({ playerId });

        if (!playerStats) {
            // if no entry, create a new one
            playerStats = new GameModel({
                guildId,
                playerId,
                playerName,
                gamesWon: 0,
                gamesPlayed: 0,
            });
        }

        playerStats.playerName = playerName;

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
