const { SlashCommandBuilder } = require('discord.js');
const Watcher = require('../../models/watcherSchema.js');

const activeWatchers = require('./startWatcher.js').activeWatchers;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwatch')
        .setDescription('Stop watching a website.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The website URL to stop watching')
                .setRequired(true)
        ),
    async execute(interaction) {
        const url = interaction.options.getString('url');
        const userId = interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        const result = await Watcher.findOneAndDelete({ userId, url });
        if (result) {
            const key = `${userId}:${url}`;
            if (activeWatchers.has(key)) {
                clearInterval(activeWatchers.get(key));
                activeWatchers.delete(key);
            }
            await interaction.editReply(`Ali will no longer keep track of **${url}**.`);
        } else {
            await interaction.editReply(`Ali hasn't been keeping track of **${url}**.`);
        }
    }
};
