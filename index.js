const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const config = require('./config.json');
const { initWatchers, startWatcher, getWebsite } = require('./commands/utility/startWatcher.js');
const Watcher = require('./models/watcherSchema.js');
const mongoose = require('mongoose');
const pendingApprovals = new Map();
module.exports = pendingApprovals;

mongoose.connect(config.mongoURI, {
}).then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}
// readyyyy
client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    try {
        await initWatchers(client);
        console.log('Website watchers initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize website watchers:', err);
    }
});
// command event handler
client.on(Events.InteractionCreate, async interaction => {

    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            }
        }
    } else if (interaction.isAutocomplete()) {

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            }
        }
    }

    if (interaction.isButton()) { // button..!
        const [action, requestId] = interaction.customId.split('_');
        const request = pendingApprovals.get(requestId);

        if (!request) {
            await interaction.reply({ content: 'Ali is having trouble finding your request.', flags: MessageFlags.Ephemeral });
            return;
        }
        const { userId, url, intervalHours } = request;

        if (interaction.user.id !== config.ownerId) {
            await interaction.reply({ content: "nuh uh!", flags: MessageFlags.Ephemeral });
            return;
        }

        if (action === 'approve') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                const { content, contentHash } = await getWebsite(url);

                const doc = await Watcher.create({
                    userId,
                    guildId: null,
                    url,
                    contentHash,
                    intervalHours
                });

                startWatcher(interaction.client, doc, content);

                await interaction.editReply(`Approved and started watching **${url}** for <@${userId}>.`);
                const user = await interaction.client.users.fetch(userId);
                await user.send(`Boss says he approved your watch request for ${url}, my friend.`);
            } catch (err) {
                console.error('Approval failed:', err);
                await interaction.editReply(`Error starting watcher: ${err.message}`);
            }
        }

        if (action === 'deny') {
            await interaction.reply({ content: `Denied watcher request for **${url}**.`, flags: MessageFlags.Ephemeral });
            const user = await interaction.client.users.fetch(userId);
            await user.send(`Boss says your request to watch ${url} is a no-go.`);
        }

        pendingApprovals.delete(requestId);
        return;
    }
});
client.login(config.token);
