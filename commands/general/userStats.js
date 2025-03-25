const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/userSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Get stats for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('user to show stats for')
                .setRequired(false)
        ),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const user = interaction.options.getUser('user') || interaction.user;
        const userId = user.id;
        const gameName = interaction.options.getString('game').toLowerCase();
        const sortBy = interaction.options.getString('sortby') || 'gamesWon';

        let userStats = await User.findOne({ userId });

        let seconds = userStats.longestGameDuration;
        let hours = Math.floor(seconds / 3600);
        let minutes = Math.floor((seconds % 3600) / 60);
        let remainingSeconds = seconds % 60;

        await interaction.reply(`### ${userStats.userName}
Total # of games played: ${userStats.gamesPlayed}
Total # of games won: ${userStats.gamesWon}
Current win-streak: ${userStats.currentWinStreak}
Longest game: ${hours}h ${minutes}m ${remainingSeconds}s (${userStats.longestGameName})
`);
    }
}
