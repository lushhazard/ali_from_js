const { SlashCommandBuilder } = require('discord.js');
const Watcher = require('../../models/watcherSchema.js');

// const activeWatchers = require('./startWatcher.js').activeWatchers;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listwatchers')
        .setDescription('List all your active watchers'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const watchers = await Watcher.find({ userId });
        if (watchers.length === 0) {
            return interaction.reply(`Is Ali supposed to be watching something for you?`);
        }

        const watcherList = watchers.map(watcher => `- \`${watcher.url}\` (Every ${watcher.intervalHours}hrs, last checked <t:${Math.floor(watcher.lastChecked.getTime() / 1000)}:R>)`).join('\n');

        interaction.reply(`For you, Ali is watching:\n${watcherList}`);
    }
};
