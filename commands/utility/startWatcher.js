const { MessageFlags, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { diffLines } = require('diff');
const Watcher = require('../../models/watcherSchema.js');
const fs = require('fs');
const config = require('../../config.json');

const activeWatchers = new Map(); // memory cache: url+userId → interval handle

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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const existing = await Watcher.findOne({ userId, url });
        if (existing) {
            await interaction.editReply(`I'm already keeping an eye on that link (every ${existing.intervalHours} hours).`);
            return;
        }

        try {
            const { content, hash } = await getWebsite(url);

            const owner = await interaction.client.users.fetch(config.ownerId);

            const approvalEmbed = new EmbedBuilder()
                .setTitle('New Watch Request')
                .setDescription(`**User**: <@${userId}>\n**URL:** ${url}\n**Interval:** ${intervalHours}h`)
                .setColor('Yellow')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_${userId}_${Buffer.from(url).toString('base64')}`)
                    .setLabel('◯')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`deny_${userId}_${Buffer.from(url).toString('base64')}`)
                    .setLabel('☓')
                    .setStyle(ButtonStyle.Danger)
            );

            await owner.send({ embeds: [approvalEmbed], components: [row] });

            await interaction.editReply(
                `I'll let the boss know about your request... Ali guarantees nothing.`
            );

        } catch (err) {
            console.error('Failed to watch site:', err.message);
            await interaction.editReply(`Ali can't tell what that link is.`);
        }
    }
};

// -----------------------
// Watcher helper functions
// -----------------------

async function getWebsite(targetUrl) {
    const response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; alifromjs/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
        },
        decompress: true
    });
    const content = sanitizeHTML(response.data);
    const hash = simpleHash(content);
    return { content, hash };
}

function startWatcher(client, doc, initialContent) {
    const key = `${doc.userId}:${doc.url}`;
    if (activeWatchers.has(key)) return;

    let lastContent = initialContent;
    const intervalMs = doc.intervalHours * 60 * 60 * 1000;

    const handle = setInterval(async () => {
        try {
            const { content: newContent, hash: newHash } = await getWebsite(doc.url);

            const dbDoc = await Watcher.findOne({ userId: doc.userId, url: doc.url });
            if (!dbDoc) {
                clearInterval(handle);
                activeWatchers.delete(key);
                return;
            }

            if (newHash !== dbDoc.contentHash) {
                const changes = diffLines(lastContent, newContent);
                let diffOutput = '';

                for (const part of changes) {
                    if (!part.added && !part.removed) continue;
                    const prefix = part.added ? '+' : '-';
                    const lines = part.value.split('\n').filter(l => l.trim() !== '');
                    for (const line of lines) {
                        diffOutput += `${prefix}${line}\n`;
                    }
                }

                const safeUrl = doc.url
                    .replace(/^https?:\/\//i, '')
                    .replace(/[^a-zA-Z0-9._-]/g, '_')
                    .slice(0, 100);

                const filename = `diff-${safeUrl}-${Date.now()}.txt`;

                const tmpDir = `./tmp/`;
                if (!fs.existsSync(tmpDir)) {
                    fs.mkdirSync(tmpDir, { recursive: true });
                }
                const outputPath = `${tmpDir}/${filename}.txt`;
                fs.writeFileSync(outputPath, diffOutput, 'utf8');

                let preview = diffOutput.length > 1800
                    ? diffOutput.slice(0, 1800) + '\n... (see attached file for full diff)'
                    : diffOutput;

                dbDoc.contentHash = newHash;
                dbDoc.lastChecked = new Date();
                await dbDoc.save();
                lastContent = newContent;

                const user = await client.users.fetch(dbDoc.userId);
                const attachment = new AttachmentBuilder(outputPath, { name: filename });

                await user.send({
                    content: `Psst, Ali sees **${dbDoc.url}** has changed!\nHere's the tea:\n` +
                        '```diff\n' + preview + '```',
                    files: [attachment]
                });
            }
        } catch (err) {
            console.error(`Watcher error (${doc.url}):`, err.message);
        }
    }, intervalMs);

    activeWatchers.set(key, handle);
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
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '')                  // remove all other tags
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
        .replace(/\b\d{10,13}\b/g, '')
        .replace(/[ \t]+/g, ' ')
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
            const { content } = await getWebsite(doc.url);
            startWatcher(client, doc, content);
        } catch (err) {
            console.error(`Failed to restore watcher for ${doc.url}:`, err.message);
        }
    }
};

module.exports.activeWatchers = activeWatchers;
module.exports.getWebsite = getWebsite;
module.exports.startWatcher = startWatcher;
