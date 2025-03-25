const mongoose = require('mongoose');
const getGameModel = require('../models/scoreboardSchema');
const User = require('../models/userSchema');
const config = require('../config.json');

const aggregateUserStats = async () => {
    await mongoose.connect(config.mongoURI, {
    }).then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray(); // Fetch all collections

    const gameCollections = collections.filter(col => col.name.includes('_'));

    const userStats = new Map();

    for (const collection of gameCollections) {
        console.log(collection.name)
        const [guildId, gameName] = collection.name.split('_');
        const gameModel = getGameModel(guildId, gameName);
        const gameData = await gameModel.find({});

        for (const player of gameData) {
            const { playerId, playerName, gamesPlayed, gamesWon } = player;

            if (!userStats.has(playerId)) {
                userStats.set(playerId, {
                    userId: playerId,
                    userName: playerName,
                    gamesPlayed: 0,
                    gamesWon: 0,
                    longestGameName: 'Unknown',
                    longestGameDuration: 0,
                    currentWinStreak: 0,
                });
            }

            const user = userStats.get(playerId);
            user.gamesPlayed += gamesPlayed;
            user.gamesWon += gamesWon;
        }
    }

    for (const [userId, userData] of userStats) {
        await User.findOneAndUpdate(
            { userId },
            userData,
            { upsert: true, new: true }
        );
    }

    console.log('User stats aggregation complete.');
    await mongoose.disconnect();
};

aggregateUserStats().catch(console.error);
