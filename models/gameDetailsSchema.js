const { Schema, model } = require('mongoose');

// Game Details Schema
const gameDetailsSchema = new Schema({
    guildId: { type: String, required: true },
    gameName: { type: String, required: true, unique: true },
    maxPlayers: { type: Number, required: true },
    minPlayers: { type: Number, default: 1 },
    winThreshold: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' },
    trackedAt: { type: Date, default: Date.now },
    gamesPlayed: { type: Number, default: 0 },
});

gameDetailsSchema.index({ guildId: 1, gameName: 1 }, { unique: true });

const GameDetails = model('GameDetails', gameDetailsSchema);
module.exports = GameDetails;
