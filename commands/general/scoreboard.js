const { SlashCommandBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const getGameModel = require('../../models/scoreboardSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scoreboard')
        .setDescription('Get the scoreboard for a game')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game to get the scoreboard for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sortby')
                .setDescription('Sort the scoreboard by this field')
                .setRequired(false)
                .addChoices(
                    { name: 'Wins', value: 'gamesWon' },
                    { name: 'Games Played', value: 'gamesPlayed' }
                )
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const gameName = interaction.options.getString('game').toLowerCase();
        const sortBy = interaction.options.getString('sortby') || 'gamesWon';

        await interaction.deferReply();

        const Game = getGameModel(guildId, gameName);

        const playerScores = await Game.find().sort({ [sortBy]: -1 });

        if (playerScores.length === 0) {
            return interaction.editReply({
                content: `No scoreboard data found for the game \`${gameName}\` in this server.`,
            });
        }

        // Generate the scoreboard image
        const scoreboardImagePath = generateScoreboardImage(playerScores, gameName);

        // Send the generated image to Discord
        await interaction.editReply({
            content: `Here's the scoreboard for ${gameName} sorted by ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}:`,
            files: [scoreboardImagePath],
        });
    },
};

// Function to generate the scoreboard image using canvas
function generateScoreboardImage(playerScores, gameName) {
    const canvasWidth = 600;
    const canvasHeight = (100 + (40 * playerScores.length));
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set fonts for title and text
    ctx.font = '30px Noto Sans CJK JP';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    // Title of the scoreboard
    ctx.fillText(`Scoreboard for ${gameName}`, canvasWidth / 2, 50);

    // Set smaller font for the players' data
    ctx.font = '20px Noto Sans CJK JP';
    // Notes to self: 
    // - split 3 times makes 4 columns technically
    // - columnWidth + left padding = left pos
    // - columnwidth * splitCount - right padding = right pos
    //
    const lPad = 10
    const rPad = 10

    const splitCount = 4;
    const columnWidth = canvasWidth / splitCount;
    let columnPositions = []
    for (let i = 0; i < splitCount; i++) {
        if (i === 0) { columnPositions[i] = lPad }
        else {
            columnPositions[i] = columnWidth + (columnWidth * i)
        }
    }
    let vertical_offset = 110;

    // Draw headers for the columns
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText('Player Name', columnPositions[0], vertical_offset - 10);
    ctx.fillText('Games Won', columnPositions[1], vertical_offset - 10);
    ctx.fillText('Games Played', columnPositions[2], vertical_offset - 10);

    // Draw player data in rows
    playerScores.forEach((player, index) => {
        const playerName = player.playerName;
        const gamesWon = player.gamesWon;
        const gamesPlayed = player.gamesPlayed;

        yOffset = vertical_offset + 20 + index * 30;

        ctx.textAlign = 'left';
        ctx.fillText(playerName, 0, yOffset);

        ctx.textAlign = 'right';
        ctx.fillText(gamesWon, columnPositions[1], yOffset);

        ctx.textAlign = 'right';
        ctx.fillText(gamesPlayed, columnPositions[2], yOffset);
    });

    // Convert the canvas to an image buffer and save it
    const outputPath = `./scoreboard-${gameName}.png`;
    const buffer = canvas.toBuffer('image/png');

    // Save the image to disk
    const fs = require('fs');
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
}
