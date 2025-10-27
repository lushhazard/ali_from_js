const { Schema, model } = require('mongoose');

const watcherSchema = new Schema({
    userId: { type: String, required: true },
    guildId: { type: String },
    url: { type: String, required: true },
    contentHash: { type: String, required: true },
    intervalHours: { type: Number, default: 24 },
    lastChecked: { type: Date, default: Date.now }
});

watcherSchema.index({ userId: 1, url: 1 }, { unique: true });

module.exports = model('Watcher', watcherSchema);
