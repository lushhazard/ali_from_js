const { MessageFlags, SlashCommandBuilder } = require('discord.js');
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
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        const watchers = await Watcher.find({ userId });
        let choices = watchers.map(watcher => watcher.url);
        const focusedOption = interaction.options.getFocused(true);
        const filtered = choices.filter(choice => choice.startsWith(focusedOption.value));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    },
    async execute(interaction) {
        const url = interaction.options.getString('url');
        const userId = interaction.user.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
