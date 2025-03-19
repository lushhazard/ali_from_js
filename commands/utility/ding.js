const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ding')
        .setDescription('Replies with Dong!'),
    async execute(interaction) {
        await interaction.reply('Dong!');
    },
};
