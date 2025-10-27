const { SlashCommandBuilder } = require('discord.js');
const Watcher = require('../../models/watcherSchema.js');

const activeWatches = require('./startWatcher.js').activeWatches; // optional if exported

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
            if (activeWatches.has(key)) {
                clearInterval(activeWatches.get(key));
                activeWatches.delete(key);
            }
            await interaction.editReply(`Ali will no longer keep track of **${url}**.`);
        } else {
            await interaction.editReply(`Ali hasn't been keeping track of **${url}**.`);
        }
    }
};
