const { Schema, model } = require('mongoose');

const traderSchema = new Schema({
    // Unique identifier for player or NPC
    traderId: { type: String, required: true, unique: true },
    role: { type: Boolean, required: true },
    name: { type: String, required: true },
    currency: { type: Number, default: 0 },
    // reputation value
    reputation: { type: Number, default: 0 },
    // Appraisal skills: Different skills for different item types (swords, artifacts, pottery, etc.)
    // consider how to make this balanced
    appraisalSkills: [
        {
            itemType: { type: String, default: "General appraisal ability" },
            skillLevel: { type: Number, default: 0 },  // 0-100 scale of expertise
        }
    ],
    inventory: [
        {
            treasureId: { type: String },  // Reference to the treasure item
        }
    ],

    marketStatus: {
        isSelling: { type: Boolean, default: false },
        isBuying: { type: Boolean, default: false },
        isAppraising: { type: Boolean, default: false },
    },

    // transaction history: transactions involving buying, selling, appraising, etc.
    transactionHistory: [
        {
            action: { type: String, required: true, enum: ['buy', 'sell', 'trade', 'appraise'] },
            itemId: { type: String, required: true },
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
        }
    ],

    // NPC-specific stuff
    npcTraits: {
        mentalState: { type: String },
        thoughts: [{ type: String }],
        interests: [{ type: String }],
        goals: [{ type: String }],
        pricingBehavior: {
            minPrice: { type: Number, default: 1 },
            maxPrice: { type: Number, default: 1000 },
            profitMargin: { type: Number, default: 0.1 },
        },
        scumminess: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

traderSchema.index({ userId: 1 });
traderSchema.index({ isPlayer: 1 });

module.exports = model('Trader', traderSchema);
