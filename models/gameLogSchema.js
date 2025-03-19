const { Schema, model } = require('mongoose');

const gameLogSchema = new Schema({
    guildId: { type: String, required: true }, // Links to a specific server
    gameName: { type: String, required: true }, // Game name
    losers: [
        {
            playerId: { type: String, required: true }, // Player's Discord ID
            playerName: { type: String, required: true }, // Player's Discord username
        }
    ],
    winners: [
        {
            playerId: { type: String, required: true }, // Winner's Discord ID
            playerName: { type: String, required: true }, // Winner's Discord username
        }
    ],
    gameDuration: { type: Number, required: true }, // Duration of the game in seconds
    timestamp: { type: Date, default: Date.now }, // Timestamp when the game ended
});

module.exports = model('GameLog', gameLogSchema);
