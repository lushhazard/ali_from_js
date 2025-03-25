const { Schema, model } = require('mongoose');

const userSchema = new Schema({
    // tracks misc fun data for users globally
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    longestGameName: { type: String, default: '' },
    longestGameDuration: { type: Number, default: 0 },
    currentWinStreak: { type: Number, default: 0 },
});

module.exports = model('User', userSchema);
