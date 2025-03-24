const { ActionRowBuilder, UserSelectMenuBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const GameLog = require('../../models/gameLogSchema');
const GameDetails = require('../../models/gameDetailsSchema');
const getGameModel = require('../../models/scoreboardSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finishgame')
        .setDescription('Finish a game and register the winners and players')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game that was played')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addFloatOption(option =>
            option.setName('time')
                .setDescription('Duration of the game in minutes')
                .setRequired(false) // Time... is optional!
        ),

    async autocomplete(interaction) {
        // autocomplete game suggestions
        const guildId = interaction.guild.id;
        const games = await GameDetails.find({ guildId });
        let choices = games.map(game => game.gameName);
        const focusedOption = interaction.options.getFocused(true);
        const filtered = choices.filter(choice => choice.startsWith(focusedOption.value));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    },
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const gameName = interaction.options.getString('game').toLowerCase();
        const gameDetails = await GameDetails.findOne({ guildId, gameName });

        if (!gameDetails) {
            return interaction.reply({
                content: `The game \`${gameName}\` is not registered yet my friend. Please register it first.`,
            });
        }
        const providedTime = interaction.options.getFloat('time');
        let gameTime = providedTime * 60;

        if (!gameTime && gameDetails.currentlyActive) {
            const gameStartTime = gameDetails.gameTime;
            // convert milliseconds to minutes
            gameTime = Math.floor((Date.now() - gameStartTime) / 1000);
        }
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
    const winnersSelect = new UserSelectMenuBuilder()
        .setCustomId('winners')
        .setPlaceholder('Select winners')
        .setMinValues(1)
        .setMaxValues(10);

    const playersSelect = new UserSelectMenuBuilder()
        .setCustomId('losers')
        .setPlaceholder('Select losers')
        .setMinValues(1)
        .setMaxValues(10);

    const doneButton = new ButtonBuilder()
        .setCustomId('done')
        .setLabel('Done')
        .setStyle(ButtonStyle.Success);

    // Create action rows for UI
    const row1 = new ActionRowBuilder().addComponents(winnersSelect);
    const row2 = new ActionRowBuilder().addComponents(playersSelect);
    const row3 = new ActionRowBuilder().addComponents(doneButton);

    await interaction.reply({
        content: 'Please tell me who the winners and losers were for this game, then press **Done**.',
        components: [row1, row2, row3],
    });

    // Collector to handle user interactions
    const collector = interaction.channel.createMessageComponentCollector({
        time: 120000, // 2-minute timeout
    });

    let winners = [];
    let losers = [];

    collector.on('collect', async (collectedInteraction) => {
        const { customId, values, user } = collectedInteraction;

        if (!(user.id === interaction.user.id)) {
            return collectedInteraction.reply({
                content: `-# Psst, my friend, don't meddle in other people's business. Go play a game or something.`,
                flags: MessageFlags.Ephemeral
            });
        }
        if (customId === 'winners') {
            winners = values;
            await collectedInteraction.update({
                content: `✔ **Winners selected:** ${winners.map(v => `<@${v}>`).join(', ')}`,
                components: [row1, row2, row3],
            });
        }
        else if (customId === 'losers') {
            losers = values;
            await collectedInteraction.update({
                content: `✔ **Losers selected:** ${losers.map(p => `<@${p}>`).join(', ')}`,
                components: [row1, row2, row3],
            });
        }
        else if (customId === 'done') {
            if (!winners.length || !losers.length) {
                return collectedInteraction.reply({
                    content: `
My friend! Please tell me about the winners *and* losers before finishing!\n
If you intended for there to be no winners or no losers, put Ali there. I will take care of it.
`,
                    flags: MessageFlags.Ephemeral
                });
            }
            // filter to make sure this bot is not in the winner or loser
            // this allows for no winners and no losers (preferable to not checking imo)
            let botId = interaction.client.user.id;
            losers = losers.filter(playerId => !(playerId === botId));
            winners = winners.filter(playerId => !(playerId === interaction.client.user.id));
            losers = losers.filter(playerId => !winners.includes(playerId));

            await registerGameResults(winners, losers, interaction, gameName, gameTime);
            await updateScoreboard(winners, losers, interaction, gameName);
            let completionMessage = await generateCompletionMessage(winners, losers);
            await collectedInteraction.update({
                content: completionMessage,
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

async function registerGameResults(winners, losers, interaction, gameName, gameTime) {
    try {
        if (!gameTime) {
            throw new Error('Game duration is missing.');
        }
        guildId = interaction.guild.id
        console.log(guildId);
        // Fetch user details from Discord API (to get usernames)
        const winnerDetails = winners.map(userId => {
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

async function updateScoreboard(winners, losers, interaction, gameName) {
    const allPlayers = [...winners, ...losers]; // Combine winners and losers into all players

    guildId = interaction.guild.id

    const GameModel = getGameModel(guildId, gameName);

    for (const playerId of allPlayers) {

        user = interaction.guild.members.cache.get(playerId);
        playerName = user ? user.user.displayName : 'Unknown';
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

        // If the player is a winner, increment their games won
        if (winners.includes(playerId)) {
            playerStats.gamesWon++;
        }

        // Save the updated player stats
        await playerStats.save();
    }

    console.log('Scoreboard updated!');
}

async function generateCompletionMessage(winners, losers) {
    console.log(`
generating completion message:\n
win ${winners} length ${winners.length}
\nlose ${losers} length ${losers.length}
`)
    let compMessage = `
I've written down the results!\n
🏆 **Winners:** ${winners.map(v => `<@${v}>`).join(', ')}\n
<:WAJAJA:1193956228242620606> **Losers:** ${losers.map(l => `<@${l}>`).join(', ')}
`;
    if (winners.length == 0) {
        let regex = /Winners:.*/i;
        compMessage = compMessage.replace(regex, "Winner:** ... Nobody? What?");
    } else if (winners.length == 1) {
        compMessage = compMessage.replace("Winners", "Winner");
    }
    if (losers.length == 0) {
        let regex = /Losers:.*/i;
        compMessage = compMessage.replace(regex, "Losers:** ... Nobody.");
    } else if (losers.length == 1) {
        compMessage = compMessage.replace("Losers", "Loser");
    }
    return compMessage;
}
