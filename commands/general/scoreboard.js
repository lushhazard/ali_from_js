const { SlashCommandBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const getGameModel = require('../../models/scoreboardSchema');
const GameDetails = require('../../models/gameDetailsSchema');
const fs = require('fs');

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
                content: `Theres nothing recorded in my notes for \`${gameName}\` in this bazaar.`,
            });
        }

        // Generate the scoreboard image
        const scoreboardImagePath = await generateScoreboardImage(playerScores, gameName, guildId);

        // Send the generated image to Discord
        await interaction.editReply({
            content: `Here's the scoreboard for ${gameName.charAt(0).toUpperCase() + gameName.slice(1)} sorted by ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}:`,
            files: [scoreboardImagePath],
        });
    },
};

// Function to generate the scoreboard image using canvas
async function generateScoreboardImage(playerScores, gameName, guildId) {
    const canvasWidth = 460;
    const canvasHeight = (140 + (30 * playerScores.length));
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    const imagePath = './assets/parchment.jpg';

    // Draw background
    ctx.fillStyle = '#f0f0f0';

    // draw image as background:
    try {
        const image = await loadImage(imagePath)
        // Draw the image on the canvas at position (0, 0)

        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

        // Set fonts for title and text
        ctx.font = 'bold 20px Noto Serif CJK JP Black';
        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';

        // Title of the scoreboard
        ctx.fillText(`Scoreboard for ${gameName.charAt(0).toUpperCase() + gameName.slice(1)}`, canvasWidth / 2, 50);

        // Set smaller font for the players' data
        ctx.font = 'underline 20px Noto Serif CJK JP Black';

        const lPad = 16
        const columnCount = 4;
        const columnWidth = ((canvasWidth - lPad) / columnCount);
        const centering = columnWidth / 2;
        const rightering = columnWidth - lPad;

        let columnPositions = []
        for (let i = 0; i < columnCount; i++) {
            columnPositions[i] = (columnWidth * i) + lPad;
        }

        let vertical_offset = 110;

        // Draw headers for the columns
        ctx.fillStyle = '#111';
        ctx.textAlign = 'left';
        ctx.fillText('Player Name', columnPositions[0], vertical_offset - 10);
        ctx.textAlign = 'right';
        ctx.fillText('Won', columnPositions[1] + rightering, vertical_offset - 10);
        ctx.fillText('Played', columnPositions[2] + rightering, vertical_offset - 10);
        ctx.fillText('Winrate', columnPositions[3] + rightering, vertical_offset - 10);

        ctx.font = '20px Noto Serif CJK JP SemiBold';


        // Draw player data in rows
        playerScores.forEach((player, index) => {
            const playerName = player.playerName;
            const gamesWon = player.gamesWon;
            const gamesPlayed = player.gamesPlayed;
            const winPercent = ((gamesWon / gamesPlayed) * 100).toFixed(1);

            yOffset = vertical_offset + 20 + index * 30;

            ctx.textAlign = 'left';
            ctx.fillText(playerName, columnPositions[0], yOffset);

            ctx.textAlign = 'right';
            ctx.fillText(gamesWon, columnPositions[1] + rightering, yOffset);
            ctx.fillText(gamesPlayed, columnPositions[2] + rightering, yOffset);
            ctx.fillText(winPercent + "%", columnPositions[3] + rightering, yOffset);
        });

        const buffer = canvas.toBuffer('image/png');
        const outputPath = `./tmp/${guildId}-${gameName}.png`;

        fs.writeFileSync(outputPath, buffer);
        return outputPath;

    } catch (error) {
        console.error("Error loading image or generating scoreboard:", error);
        throw new Error("Failed to generate scoreboard image");
    }
}
