const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ding')
        .setDescription('Replies with Dong!'),
    async execute(interaction) {
        await interaction.reply(`Dong. Did you want something?\n
-# This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.\n
-# Current guild is ${interaction.guild.name} which has ${interaction.guild.memberCount} members.`);
    },
};
