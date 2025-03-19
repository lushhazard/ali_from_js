const { Sequelize, DataTypes } = require('sequelize');

// init sqlite db
const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    // SQLite only
    storage: 'database.sqlite',
});

const Tags = sequelize.define('tags', {
    userid: {
        type: Sequelize.STRING,
        unique: true,
    },
    currency: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    bad_currency: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
});

module.exports = { sequelize, Tags };
