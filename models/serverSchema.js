const { Schema, model } = require('mongoose');

const serverSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    trackedGames: [{ type: String }] // List of tracked games
});

module.exports = model('Server', serverSchema);
