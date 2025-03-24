const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randomcommander')
        .setDescription('Fetch random commanders from scryfall.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The number of commanders to fetch')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(10)
        )
        .addStringOption(option =>
            option.setName('args')
                .setDescription('Additional filters for the query.')
                .setRequired(false)
        ),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const args = interaction.options.getString('args') || 'f:commander -t:background';
        const scryfallUrl = 'https://api.scryfall.com/cards/random?q=is%3Acommander';
        const finalUrl = `${scryfallUrl}+${encodeURIComponent(args)}`;

        try {
            // Validate amount
            if (amount === 0) {
                return interaction.reply("Zero commanders, coming right up... *sigh*");
            }

            await interaction.deferReply();

            // Prepare canvas to store images
            const canvas = createCanvas(362 * amount, 505);
            const ctx = canvas.getContext('2d');

            // Fetch the commanders and create the collage
            for (let x = 0; x < amount; x++) {
                // Wait for half a second to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 500));

                const response = await axios.get(finalUrl);
                const data = response.data;

                if (!data || !data.image_uris) {
                    return interaction.editReply("There was an error fetching the commander.");
                }

                let cardImgUrl = data.layout === 'modal_dfc' || data.layout === 'transform' ?
                    data.card_faces[0].image_uris.normal : data.image_uris.normal;

                // Load the card image
                const cardImage = await loadImage(cardImgUrl);
                ctx.drawImage(cardImage, 362 * x, 0, 362, 505);

                // Additional logic for partner and background images
                if (data.keywords.some(keyword => keyword.toLowerCase().includes('partner with'))) {
                    const partnerQuery = encodeURIComponent(data.oracle_text.match(/Partner with (.*?)(?=\s|$)/)[1]);
                    const partnerResponse = await axios.get(`https://api.scryfall.com/cards/search?q=${partnerQuery}`);
                    const partnerImgUrl = partnerResponse.data.data[0].image_uris.normal;
                    const partnerImage = await loadImage(partnerImgUrl);
                    ctx.drawImage(partnerImage, 362 * x + 147, 205, 215, 300);
                }
                if (data.keywords.some(keyword => keyword.toLowerCase().includes('choose a background'))) {
                    const backgroundResponse = await axios.get('https://api.scryfall.com/cards/random?q=t%3Abackground');
                    const backgroundImgUrl = backgroundResponse.data.image_uris.normal;
                    const backgroundImage = await loadImage(backgroundImgUrl);
                    ctx.drawImage(backgroundImage, 362 * x + 147, 205, 215, 300);
                }
                if (data.keywords.some(keyword => keyword.toLowerCase().includes('friends forever'))) {
                    const ffResponse = await axios.get('https://api.scryfall.com/cards/random?q=o%3A%22friends+forever%22');
                    const ffImgUrl = ffResponse.data.image_uris.normal;
                    const ffImage = await loadImage(ffImgUrl);
                    ctx.drawImage(ffImage, 362 * x + 147, 205, 215, 300);
                }
            }
            // Save the collage as a PNG image
            const buffer = canvas.toBuffer('image/png');
            const filePath = `./assets/${interaction.user.id}_rcommander.png`
            fs.writeFileSync(filePath, buffer);

            // Send the image to Discord
            await interaction.editReply({ content: `Here are your ${amount} random commanders, my friend.`, files: [filePath] });

        } catch (error) {
            console.error(error);
            return interaction.editReply("There was an error fetching the commanders.");
        }
    }
};
