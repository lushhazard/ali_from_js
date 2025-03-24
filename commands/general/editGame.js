const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GameDetails = require('../../models/gameDetailsSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editgame')
        .setDescription('Add/edit game info for tracked games.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('addpin')
                .setDescription('Add a pin, like a link etc')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The name of the game to add a pin to')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Text to be pinned')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removepin')
                .setDescription('Remove a pin (gives you a menu)')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The name of the game to remove a pin from')
                        .setAutocomplete(true)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('description')
                .setDescription('Edit the description of a game')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The name of the game to edit the description for')
                        .setAutocomplete(true)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('The new description of the game')
                        .setRequired(false))),
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
        const gameName = interaction.options.getString('game').toLowerCase();
        const guildId = interaction.guild.id;
        const currentOption = interaction.options.getSubcommand();

        try {
            // check if game already exists in the database
            let gameDetails = await GameDetails.findOne({ guildId, gameName });

            if (!gameDetails) {
                return interaction.reply(`Im afraid \`${gameName}\` isn't registered in this bazaar yet my friend. You have to create it first!`);
            }
            if (currentOption === 'addpin') { ///////////////////////
                gameDetails.savedInfo.push(interaction.options.getString('text'));
                await interaction.reply(`Your pin has been added to ${gameName}, my friend!`);
                await gameDetails.save();

            } else if (currentOption === 'removepin') { /////////////
                const pins = gameDetails.savedInfo;
                const pinText = pins.map((pin, index) => `${index + 1}. ${pin}`).join('\n');

                await interaction.reply({
                    content: `\n${pinText}\nPlease send a message containing only the number of the option from the list that you want to remove:`
                });

                const collectorFilter = m => (m.author.id === interaction.user.id);
                //collects for 30s
                const collector = interaction.channel.createMessageCollector({ filter: collectorFilter, time: 30_000 });

                collector.on('collect', async (m) => {
                    console.log(`Collected ${m.content}`);
                    let sentNumber = Number(m.content);
                    if (sentNumber === NaN) {
                        return m.reply({
                            content: "Your message contains other stuff than numbers. Try again my friend. Next time, numbers only.",
                        });
                    } else if (pins[sentNumber - 1] === undefined) {
                        return m.reply({
                            content: "Your number... is not on the list my friend. Try again.",
                        });
                    }
                    // removes sentnumber
                    gameDetails.savedInfo.splice(sentNumber - 1, 1);
                    console.log("finished collecting and stuff");
                    await gameDetails.save();

                    collector.stop();
                });
                collector.on('end', collected => {
                    console.log(`Collected ${collected.size} items`);
                    interaction.followUp({
                        content: `Successfully removed the pin.`,
                    });
                });
                await gameDetails.save();

            } else if (currentOption === 'description') { ///////////
                gameDetails.description = interaction.options.getString('description');
                interaction.reply(`${gameName} has been updated, my friend!`);
                await gameDetails.save();
            }

            console.log("finished editing game info")
        } catch (error) {
            console.error(error);
            interaction.reply(`-# error: \nMy notebook caught on fire, i'll fetch a new one... Ali apologizes for this inconvenience.`);
        }
    }
};
