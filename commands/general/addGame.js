const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GameDetails = require('../../models/gameDetailsSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addgame')
        .setDescription('Add a game with details to track.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The name of the game to add')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the game')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const gameName = interaction.options.getString('game').toLowerCase();
        const description = interaction.options.getString('description') || '';
        const guildId = interaction.guild.id;

        try {
            // check if game already exists in the database
            let gameDetails = await GameDetails.findOne({ guildId, gameName });

            if (gameDetails) {
                return interaction.reply(`Im afraid \`${gameName}\` is already registered in this bazaar my friend.`);
            }

            // create new game entry with the provided details
            gameDetails = new GameDetails({
                guildId,
                gameName,
                description,
            });

            await gameDetails.save();

            interaction.reply(`I've dedicated a notebook for keeping track of ${gameName}, my friend. Now go play!`);
        } catch (error) {
            console.error(error);

            // handle mongodb duplicate error
            if (error.code === 11000) {
                return interaction.reply(`Im afraid that game is already registered in this bazaar my friend.`);
            }

            // handle errors nicely
            interaction.reply(`-# error:\nMy notebook caught on fire, i'll fetch a new one... Ali apologizes for this inconvenience.`);
        }
    }
};
