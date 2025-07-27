const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const { log } = require('console');

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
        console.log(finalUrl)

        try {
            // Validate amount
            if (amount === 0) {
                return interaction.reply("Zero commanders, coming right up... ");
            }
            await interaction.deferReply();

            // Prepare canvas to store images
            const cardw = 362;
            const cardh = 505;
            const smallw = 215;
            const smallh = 300;
            const smallwOffset = cardw - smallw;
            const smallhOffset = cardh - smallh;
            const canvas = createCanvas(cardw * amount, cardh);
            const ctx = canvas.getContext('2d');

            // fetch the commanders and create le collage
            for (let x = 0; x < amount; x++) {
                // wait for half a second to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 500));

                const response = await axios.get(finalUrl);
                const data = response.data;

                if (!data || !data.image_uris) {
                    return interaction.editReply("There was an error fetching the commander.");
                }

                let cardImgUrl = data.layout === 'modal_dfc' || data.layout === 'transform' ?
                    data.card_faces[0].image_uris.normal : data.image_uris.normal;

                // load the card image
                const cardImage = await loadImage(cardImgUrl);
                ctx.drawImage(cardImage, cardw * x, 0, cardw, cardh);

                // additional logic for partner and background images
                if (data.keywords.some(keyword => keyword.toLowerCase().includes('partner with'))) {
                    const partnerQuery = encodeURIComponent(data.oracle_text.match(/Partner with (.*?)(?=\s|$)/)[1]);
		    console.log(`partner with: ${partnerQuery}`)
                    const partnerResponse = await axios.get(`https://api.scryfall.com/cards/search?q=${partnerQuery}`);
                    const partnerImgUrl = partnerResponse.data.data[0].image_uris.normal;
                    const partnerImage = await loadImage(partnerImgUrl);
                    ctx.drawImage(partnerImage, cardw * x + smallwOffset, smallhOffset, smallw, smallh);
                }
		else if (data.keywords.some(keyword => keyword.toLowerCase().includes('partner'))) {
		    let partnerResponse
                    while (true) {
		        partnerResponse = await axios.get('https://api.scryfall.com/cards/random?q=o%3Apartner');
		        if (!(partnerResponse.data.keywords.some(keyword => keyword.toLowerCase().includes('partner with')))) {
			    break
			}
		    }
                    const partnerImgUrl = partnerResponse.data.data[0].image_uris.normal;
                    const partnerImage = await loadImage(partnerImgUrl);
                    ctx.drawImage(partnerImage, cardw * x + smallwOffset, smallhOffset, smallw, smallh);
                }
                if (data.keywords.some(keyword => keyword.toLowerCase().includes('choose a background'))) {
                    const backgroundResponse = await axios.get('https://api.scryfall.com/cards/random?q=t%3Abackground');
                    const backgroundImgUrl = backgroundResponse.data.image_uris.normal;
                    const backgroundImage = await loadImage(backgroundImgUrl);
                    ctx.drawImage(backgroundImage, cardw * x + smallwOffset, smallhOffset, smallw, smallh);
                }
                if (data.keywords.some(keyword => keyword.toLowerCase().includes('friends forever'))) {
                    const ffResponse = await axios.get('https://api.scryfall.com/cards/random?q=o%3A%22friends+forever%22');
                    const ffImgUrl = ffResponse.data.image_uris.normal;
                    const ffImage = await loadImage(ffImgUrl);
                    ctx.drawImage(ffImage, cardw * x + smallwOffset, smallhOffset, smallw, smallh);
                }
            }
            const buffer = canvas.toBuffer('image/jpeg');
            const filePath = `./tmp/${interaction.user.id}_rcommander.jpeg`
	    fs.mkdirSync('./tmp',{recursive:true});
            fs.writeFileSync(filePath, buffer);

            // Send the image to Discord
            if (amount === 1) {
                await interaction.editReply({ content: `Here is your random commander, my friend.`, files: [filePath] });
            } else {
                await interaction.editReply({ content: `Here are your ${amount} random commanders, my friend.`, files: [filePath] });
            }

        } catch (error) {
            console.error(error);
            return interaction.editReply(`-# error:\nYour query came up empty, my friend.`);
        }
    }
};
