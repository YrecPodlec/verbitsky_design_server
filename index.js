const express = require('express');
const { connectToDb, getDb } = require('./db');
const { ObjectId } = require('mongodb');
const cors = require('cors');
const {response, urlencoded} = require("express");
const path = require('path');
require('dotenv').config(); // Подключение файла .env

const app = express();
const PORT = 4343;
app.use(cors());
app.use(urlencoded({ extended: true })); // Для обработки данных формы
app.use(express.json());

// Middleware для защиты страницы паролем
function checkPassword(req, res, next) {
    const password = req.body.password;
    if (password === process.env.PASSWORD) {
        return next();
    } else {
        return res.status(401).send('Unauthorized: Incorrect password');
    }
}

connectToDb((err) => {
    if (err) {
        console.error('Failed to connect to the database:', err);
        process.exit(1); // Завершение процесса с кодом ошибки
    }

    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);
    });
});

app.get('/projects', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('Projects');

        const page = parseInt(req.query.page); // Текущая страница
        const limit = parseInt(req.query.limit); // Количество элементов на странице
        const language = req.query.language; // Язык по умолчанию

        const startIndex = (page - 1) * limit;

        // Создаем условие для фильтрации только тех проектов, которые содержат нужный префикс
        const query = {
            ['title-' + language]: { $exists: true } // Фильтруем проекты, у которых существует поле с нужным языковым префиксом
        };

        // Динамическая проекция для заголовка в зависимости от языка
        const projection = {
            ['title-' + language]: 1, // Выбор title-ru или title-en
            description: 1,
            images: 1,
        };

        // Подсчет общего количества проектов
        const totalProjects = await collection.countDocuments(query);

        // Получение данных с проекцией и пагинацией
        const projects = await collection.find(query, { projection })
            .skip(startIndex)
            .limit(limit)
            .toArray();

        // Преобразование данных для отправки на клиент
        const results = {
            total: totalProjects,
            results: projects.map(project => ({
                ...project,
                title: project['title-' + language], // Преобразуем title в зависимости от языка
            }))
        };

        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


// Путь к HTML-странице
app.get('/add-price', (req, res) => {
    res.sendFile(path.join(__dirname, 'form.html'));
});

// Путь к HTML-странице для изменения существующего элемента
app.get('/edit-price', (req, res) => {
    res.sendFile(path.join(__dirname, 'edit-form.html'));
});

// POST-запрос для добавления нового элемента в коллекцию PriceList
app.post('/price', checkPassword, async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('PriceList');

        const { title, services, price, category, tags, status } = req.body;

        // Валидация данных
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing "title"' });
        }
        if (!services || !Array.isArray(services.split(','))) {
            return res.status(400).json({ error: 'Invalid or missing "services"' });
        }
        if (!price || isNaN(price)) {
            return res.status(400).json({ error: 'Invalid or missing "price"' });
        }
        if (!category || typeof category !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing "category"' });
        }
        if (!tags || !Array.isArray(tags.split(','))) {
            return res.status(400).json({ error: 'Invalid or missing "tags"' });
        }
        if (status !== 'true' && status !== 'false') {
            return res.status(400).json({ error: 'Invalid or missing "status"' });
        }

        const newItem = {
            title,
            services: services.split(',').map(service => service.trim()),
            price: parseFloat(price),
            category,
            tags: tags.split(',').map(tag => tag.trim()),
            status: status === 'true',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await collection.insertOne(newItem);

        res.status(201).json({ message: 'Price item added successfully', itemId: result.insertedId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// PUT-запрос для обновления элемента в коллекции PriceList
app.put('/price/:id', checkPassword, async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('PriceList');
        const { id } = req.params;
        const { title, services, price, category, tags, status } = req.body;

        // Валидация данных
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid "id"' });
        }
        if (title && typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid "title"' });
        }
        if (services && !Array.isArray(services.split(','))) {
            return res.status(400).json({ error: 'Invalid "services"' });
        }
        if (price && isNaN(price)) {
            return res.status(400).json({ error: 'Invalid "price"' });
        }
        if (category && typeof category !== 'string') {
            return res.status(400).json({ error: 'Invalid "category"' });
        }
        if (tags && !Array.isArray(tags.split(','))) {
            return res.status(400).json({ error: 'Invalid "tags"' });
        }
        if (status !== undefined && status !== 'true' && status !== 'false') {
            return res.status(400).json({ error: 'Invalid "status"' });
        }

        const updateFields = {
            ...(title && { title }),
            ...(services && { services: services.split(',').map(service => service.trim()) }),
            ...(price && { price: parseFloat(price) }),
            ...(category && { category }),
            ...(tags && { tags: tags.split(',').map(tag => tag.trim()) }),
            ...(status !== undefined && { status: status === 'true' }),
            updatedAt: new Date(),
        };

        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.status(200).json({ message: 'Price item updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/price', async (request, response) => {
    try {
        const db = getDb();
        const collection = db.collection('PriceList');

        // Например, добавить лимит на количество возвращаемых записей (Если их тысячи и миллионы - пагинация обязательна)
        const price = await collection.find().limit(100).toArray();

        if (!price || price.length === 0) {
            return response.status(404).send('No prices found');
        }

        response.status(200).json(price);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});

app.get('/questions', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('questions');

        const page = parseInt(req.query.page) || 1; // Текущая страница
        const limit = parseInt(req.query.limit) || 9999999999; // Количество элементов на странице

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        // Получение данных
        const questions = await collection.find().toArray();
        const results = {};

        // Пагинация
        if (endIndex < questions.length) {
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
        results.results = questions.slice(startIndex, endIndex);

        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Функция для считывания изображений
async function getImages(directory) {
    const images = {};

    try {
        const folders = await fs.readdir(directory);

        for (const folder of folders) {
            const folderPath = path.join(directory, folder);
            const files = await fs.readdir(folderPath);

            images[folder] = files.map(file => ({
                name: file,
                url: `/images/${folder}/${file}` // Формируем правильный URL
            }));
        }
    } catch (error) {
        console.error('Error reading images:', error);
        throw error; // Пробрасываем ошибку
    }

    return images;
}

// Новый маршрут для получения изображений
app.get('/images', async (req, res) => {
    try {
        const images = await getImages(path.join(__dirname, 'public/images'));
        res.status(200).json(images);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Middleware для статического хостинга изображений
app.use('/images', express.static(path.join(__dirname, 'public/images')));