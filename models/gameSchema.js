const { Schema, model, connection } = require('mongoose');

const gameSchema = new Schema({
    guildId: { type: String, required: true }, // Links to a specific server
    playerId: { type: String, required: true }, // Discord User ID
    playerName: { type: String, required: true }, // Discord Username
    gamesWon: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 } // Score tracking
});

// Function to dynamically create collections for games in each server
const getGameModel = (guildId, gameName) => {
    return connection.model(`${guildId}_${gameName}`, gameSchema);
};

module.exports = getGameModel;
