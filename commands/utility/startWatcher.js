const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { diffLines } = require('diff');
const Watcher = require('../../models/watcherSchema.js');

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
        .addNumberOption(option =>
            option
                .setName('interval')
                .setDescription('How often to check (in hours, default every 24 hours)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const url = interaction.options.getString('url');
        const intervalHours = interaction.options.getNumber('interval') || WATCH_INTERVAL_DEFAULT;
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; alifromjs/1.0)',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                decompress: true
            });
            const content = sanitizeHTML(response.data);
            const hash = simpleHash(content);

            // Check if already watching
            const existing = await Watcher.findOne({ userId, url });
            if (existing) {
                await interaction.editReply(`Im already keeping an eye on that link (every ${existing.intervalHours} hours).`);
                return;
            }

            // Save to DB
            const doc = await Watcher.create({
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

            const dbDoc = await Watcher.findOne({ userId: doc.userId, url: doc.url });
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
                    if (!part.added && !part.removed) continue; // skip unchanged
                    const prefix = part.added ? '+' : '-';
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

function sanitizeHTML(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')   // remove all scripts
        .replace(/<style[\s\S]*?<\/style>/gi, '')     // remove styles
        .replace(/<!--[\s\S]*?-->/g, '')              // remove comments
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '') // remove ISO timestamps
        .replace(/\b\d{10,13}\b/g, '')                // remove Unix timestamps
        .replace(/\s+/g, ' ')                         // collapse whitespace
        .trim();
}

// -----------------------
// Rebuild watchers on startup
// -----------------------
module.exports.initWatchers = async (client) => {
    const docs = await Watcher.find({});
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
