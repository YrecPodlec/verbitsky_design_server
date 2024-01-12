const express = require('express');
const { connectToDb, getDb } = require('./db');
const { ObjectId } = require('mongodb');
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
    try {
        const db = getDb();
        const collection = db.collection('Projects');

        const page = parseInt(req.query.page) || 1; // Текущая страница
        const limit = parseInt(req.query.limit) || 9999999999; // Количество элементов на странице

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        // Получение данных
        const projects = await collection.find().toArray();
        const results = {};

        // Пагинация
        if (endIndex < projects.length) {
            results.next = {
                page: page + 1,
                limit: limit,
            };
        }

        if (startIndex > 0) {
            results.previous = {
                page: page - 1,
                limit: limit,
            };
        }

        // Ограничение данных
        results.results = projects.slice(startIndex, endIndex);

        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
