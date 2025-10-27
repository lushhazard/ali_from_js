const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { diffLines } = require('diff');
const WebsiteWatch = require('../../models/watcherSchema.js');

const activeWatches = new Map(); // memory cache: url+userId → interval handle

const WATCH_INTERVAL_DEFAULT = 24; // hours

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watch')
        .setDescription('Watches a website and notifies you if it changes.')
        .addStringOption(option =>
            option
                .setName('url')
                .setDescription('The website URL to watch')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('interval')
                .setDescription('How often to check (in hours, default every 24 hours)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const url = interaction.options.getString('url');
        const intervalHours = interaction.options.getInteger('interval') || WATCH_INTERVAL_DEFAULT;
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const response = await axios.get(url, { timeout: 10000 });
            const content = response.data;
            const hash = simpleHash(content);

            // Check if already watching
            const existing = await WebsiteWatch.findOne({ userId, url });
            if (existing) {
                await interaction.editReply(`Im already keeping an eye on that link (every ${existing.intervalHours} hours).`);
                return;
            }

            // Save to DB
            const doc = await WebsiteWatch.create({
                userId,
                guildId,
                url,
                contentHash: hash,
                intervalHours: intervalHours
            });

            startWatcher(interaction.client, doc, content);

            await interaction.editReply(`I'll keep an eye on that link, my friend.`);
        } catch (err) {
            console.error('Failed to watch site:', err.message);
            await interaction.editReply(`My friend, Ali can't see whats on the other side of that link.`);
        }
    },
};

// -----------------------
// Watcher helper functions
// -----------------------

function startWatcher(client, doc, initialContent) {
    const key = `${doc.userId}:${doc.url}`;
    if (activeWatches.has(key)) return;

    let lastContent = initialContent;
    const intervalMs = doc.intervalHours * 60 * 60 * 1000;

    const handle = setInterval(async () => {
        try {
            const res = await axios.get(doc.url, { timeout: 10000 });
            const newContent = res.data;
            const newHash = simpleHash(newContent);

            const dbDoc = await WebsiteWatch.findOne({ userId: doc.userId, url: doc.url });
            if (!dbDoc) {
                clearInterval(handle);
                activeWatches.delete(key);
                return;
            }

            if (newHash !== dbDoc.contentHash) {
                // Compute diff
                const changes = diffLines(lastContent, newContent);
                let diffOutput = '';

                for (const part of changes) {
                    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
                    const lines = part.value.split('\n').filter(l => l.trim() !== '');
                    for (const line of lines) {
                        diffOutput += `${prefix}${line}\n`;
                    }
                }

                // Limit output size (Discord max ~2000 chars per message)
                if (diffOutput.length > 1800) {
                    diffOutput = diffOutput.slice(0, 1800) + '\n... (truncated)';
                }

                // Update stored hash/content
                dbDoc.contentHash = newHash;
                dbDoc.lastChecked = new Date();
                await dbDoc.save();
                lastContent = newContent;

                const user = await client.users.fetch(dbDoc.userId);
                await user.send(
                    `Psst, Ali sees **${dbDoc.url}** has changed!\nHere's whats changed:\n\n` +
                    '```diff\n' + diffOutput + '```'
                );
            }
        } catch (err) {
            console.error(`Watcher error (${doc.url}):`, err.message);
        }
    }, intervalMs);

    activeWatches.set(key, handle);
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString();
}

// -----------------------
// Rebuild watchers on startup
// -----------------------
module.exports.initWatchers = async (client) => {
    const docs = await WebsiteWatch.find({});
    console.log(`Restoring ${docs.length} website watchers...`);

    for (const doc of docs) {
        try {
            const res = await axios.get(doc.url, { timeout: 10000 });
            startWatcher(client, doc, res.data);
        } catch (err) {
            console.error(`Failed to restore watcher for ${doc.url}:`, err.message);
        }
    }
};
