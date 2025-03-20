const { SlashCommandBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const getGameModel = require('../../models/scoreboardSchema');
const GameDetails = require('../../models/gameDetailsSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scoreboard')
        .setDescription('Get the scoreboard for a game')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game to get the scoreboard for')
                .setAutocomplete(true)
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
        const scoreboardImagePath = generateScoreboardImage(playerScores, gameName, guildId);

        // Send the generated image to Discord
        await interaction.editReply({
            content: `Here's the scoreboard for ${gameName} sorted by ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}:`,
            files: [scoreboardImagePath],
        });
    },
};

// Function to generate the scoreboard image using canvas
function generateScoreboardImage(playerScores, gameName, guildId) {
    const canvasWidth = 460;
    const canvasHeight = (100 + (40 * playerScores.length));
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#f0f0f0';

    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set fonts for title and text
    ctx.font = '20px Noto Sans CJK JP';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    // Title of the scoreboard
    ctx.fillText(`Scoreboard for ${gameName}`, canvasWidth / 2, 50);

    // Set smaller font for the players' data
    ctx.font = '20px Noto Sans CJK JP';

    const lPad = 10
    const columnCount = 3;
    const columnWidth = ((canvasWidth - lPad) / columnCount);
    const centering = columnWidth / 2;
    const rightering = columnWidth - lPad;

    let columnPositions = []
    for (let i = 0; i < columnCount; i++) {
        columnPositions[i] = (columnWidth * i) + lPad;
    }

    let vertical_offset = 110;

    // Draw headers for the columns
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText('Player Name', columnPositions[0], vertical_offset - 10);
    ctx.textAlign = 'right';
    ctx.fillText('Games Won', columnPositions[1] + rightering, vertical_offset - 10);
    ctx.fillText('Games Played', columnPositions[2] + rightering, vertical_offset - 10);

    // Draw player data in rows
    playerScores.forEach((player, index) => {
        const playerName = player.playerName;
        const gamesWon = player.gamesWon;
        const gamesPlayed = player.gamesPlayed;

        yOffset = vertical_offset + 20 + index * 30;

        ctx.textAlign = 'left';
        ctx.fillText(playerName, columnPositions[0], yOffset);

        ctx.textAlign = 'right';
        ctx.fillText(gamesWon, columnPositions[1] + rightering, yOffset);
        ctx.fillText(gamesPlayed, columnPositions[2] + rightering, yOffset);
    });

    // Convert the canvas to an image buffer and save it
    const outputPath = `./scoreboards/${guildId}-${gameName}.png`;
    const buffer = canvas.toBuffer('image/png');

    // Save the image to disk
    const fs = require('fs');
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
}
