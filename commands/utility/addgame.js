const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addgame')
        .setDescription('Add a new Game')
        .addStringOption(option =>
            option.setName('gamename')
                .setDescription('Add a new Game')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('maxusers')
                .setDescription('Max amount of users')
                .setRequired(true)),

    async execute(interaction) {
        // interaction.user is the object representing the User who ran the command
        // interaction.member is the GuildMember object, which represents the user in the specific guild
        await interaction.reply(`This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`);
    },
};
