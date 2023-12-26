const express = require('express');
const { connectToDb, getDb } = require('./db');
const {ObjectId} = require("mongodb");
const cors = require('cors');

const app = express();
const PORT = 4343;
app.use(cors());

connectToDb((err) => {
    if (err) {
        console.log(err);
        return;
    }

    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);
    });
});

app.get('/projects', async (req, res) => {
    const db = getDb();
    const collections = await db.collection('Projects').find().toArray();
    res.status(200).json(collections);
});