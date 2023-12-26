const { MongoClient } = require('mongodb');
require("dotenv").config()
const URL = process.env.DATABASE;

let dbConnection;

module.exports = {
    connectToDb: (cb) => {
        MongoClient
            .connect(URL)
            .then((client) => {
                console.log('Database connected');
                dbConnection = client.db();
                return cb();
            })
            .catch((err) => {
                console.log(err);
            });
    },
    getDb: () => dbConnection,
};
