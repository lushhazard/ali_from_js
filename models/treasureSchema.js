const { Schema, model } = require('mongoose');

const treasureSchema = new Schema({
    originGuild: { type: String, required: true },
    ownerId: { type: String, required: true },
    treasureId: { type: String, required: true, unique: true },
    treasureName: { type: String, required: true },
    treasureType: { type: String, required: true },
    description: { type: String, required: true },
    qualities: [
        {
            mod: { type: String, required: true },
            modDescription: { type: String, required: true },
        }
    ],
    currentValue: { type: Number },
    tradeHistory: [
        {
            fromUser: { type: String },
            toUser: { type: String },
            valueAtTrade: { type: Number },
            tradeDate: { type: Date, default: Date.now }
        }
    ],
    timestamp: { type: Date, default: Date.now },
});

treasureSchema.index({ treasureId: 1 });  // Unique identifier for treasures
treasureSchema.index({ ownerId: 1 });     // Quickly find treasures by owner
treasureSchema.index({ originGuild: 1 }); // Find treasures by guild

module.exports = model('Treasure', treasureSchema);
