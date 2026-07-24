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
                .setName('editpin')
                .setDescription('Edit an existing pin (gives you a menu)')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The name of the game to edit a pin for')
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
        const guildId = interaction.guild.id;
        const games = await GameDetails.find({ guildId });
        let choices = games.map(game => game.gameName);
        const focusedOption = interaction.options.getFocused(true);
        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    },
    async execute(interaction) {
        const gameName = interaction.options.getString('game').toLowerCase();
        const guildId = interaction.guild.id;
        const currentOption = interaction.options.getSubcommand();

        try {
            let gameDetails = await GameDetails.findOne({ guildId, gameName });

            if (!gameDetails) {
                return interaction.reply(`Im afraid \`${gameName}\` isn't registered in this bazaar yet my friend. You have to create it first!`);
            }

            if (currentOption === 'addpin') {
                gameDetails.savedInfo.push(interaction.options.getString('text'));
                await interaction.reply(`Your pin has been added to ${gameName}, my friend!`);
                await gameDetails.save();

            } else if (currentOption === 'removepin') {
                const pins = gameDetails.savedInfo;
                if (pins.length === 0) return interaction.reply("There are no pins to remove, my friend.");

                const pinText = pins.map((pin, index) => `${index + 1}. ${pin}`).join('\n');

                await interaction.reply({
                    content: `\n${pinText}\nPlease send a message containing only the number of the option from the list that you want to remove:`
                });

                const collectorFilter = m => m.author.id === interaction.user.id;
                const collector = interaction.channel.createMessageCollector({ filter: collectorFilter, time: 30_000, max: 1 });

                collector.on('collect', async (m) => {
                    let sentNumber = Number(m.content);
                    if (isNaN(sentNumber)) {
                        return m.reply("Your message contains other stuff than numbers. Try again my friend.");
                    } else if (pins[sentNumber - 1] === undefined) {
                        return m.reply("Your number... is not on the list my friend.");
                    }

                    gameDetails.savedInfo.splice(sentNumber - 1, 1);
                    await gameDetails.save();
                    await m.reply("Successfully removed the pin.");
                });

            } else if (currentOption === 'editpin') {
                const pins = gameDetails.savedInfo;
                if (pins.length === 0) return interaction.reply("There are no pins to edit, my friend.");

                const pinText = pins.map((pin, index) => `${index + 1}. ${pin}`).join('\n');

                await interaction.reply({
                    content: `\n${pinText}\nPlease reply with the **number** of the pin you wish to edit:`
                });

                const filter = m => m.author.id === interaction.user.id;
                const numberCollector = interaction.channel.createMessageCollector({ filter, time: 30_000, max: 1 });

                numberCollector.on('collect', async (m) => {
                    const selectedIndex = Number(m.content) - 1;

                    if (isNaN(selectedIndex) || !pins[selectedIndex]) {
                        return m.reply("That index does not exist in my records. Operational canceled.");
                    }

                    await m.reply(`You chose pin #${selectedIndex + 1}. Now, please send the **new text** for this pin:`);

                    const textCollector = interaction.channel.createMessageCollector({ filter, time: 30_000, max: 1 });

                    textCollector.on('collect', async (textMsg) => {
                        const newText = textMsg.content;
                        gameDetails.savedInfo[selectedIndex] = newText;

                        await gameDetails.save();
                        await textMsg.reply("The pin has been successfully updated, my friend!");
                    });
                });

            } else if (currentOption === 'description') {
                gameDetails.description = interaction.options.getString('description');
                interaction.reply(`${gameName} has been updated, my friend!`);
                await gameDetails.save();
            }

            console.log("finished editing game info");
        } catch (error) {
            console.error(error);
            interaction.reply(`-# error: \nMy notebook caught on fire, i'll fetch a new one... Ali apologizes for this inconvenience.`);
        }
    }
};

