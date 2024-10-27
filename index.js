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
        const lang = req.query.lang; // Язык по умолчанию

        const startIndex = (page - 1) * limit;

        // Создаем условие для фильтрации только тех проектов, которые содержат нужный префикс
        const query = {
            ['title-' + lang]: { $exists: true }, // Фильтруем проекты, у которых существует поле с нужным языковым префиксом
            ['description-' + lang]: { $exists: true } // Фильтруем проекты с нужным префиксом для description
        };

        // Динамическая проекция для заголовка и описания в зависимости от языка
        const projection = {
            ['title-' + lang]: 1, // Выбор title-ru или title-en
            ['description-' + lang]: 1, // Выбор description-ru или description-en
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
                title: project['title-' + lang], // Преобразуем title в зависимости от языка
                description: project['description-' + lang] // Преобразуем description в зависимости от языка
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
app.post('/prices', checkPassword, async (req, res) => {
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

        // Извлекаем префикс локали из query params (например, ?lang=en или ?lang=ru)
        const locale = request.query.lang;

        // Устанавливаем название полей в зависимости от локали
        let titleField, servicesField;
        if (locale === 'en') {
            titleField = 'title-en';
            servicesField = 'services-en';
        } else if (locale === 'ru') {
            titleField = 'title-ru';
            servicesField = 'services-ru';
        } else {
            // Если локаль не указана или неверная, по умолчанию используем 'ru'
            titleField = 'title-ru';
            servicesField = 'services-ru';
        }

        // Получаем данные, выбирая только нужные поля
        const price = await collection.find(
            {}, // Фильтр пустой, т.к. нам нужно выбрать все записи
            { projection: { [titleField]: 1, [servicesField]: 1, price: 1, category: 1, tags: 1, status: 1 } } // Проецируем только нужные поля
        ).limit(100).toArray();

        if (!price || price.length === 0) {
            return response.status(404).send('No prices found');
        }

        // Преобразуем результат в нужный формат для клиента (один параметр для title и services)
        const transformedPrice = price.map(item => ({
            title: item[titleField],
            services: item[servicesField],
            price: item.price,
            category: item.category,
            tags: item.tags,
            status: item.status
        }));

        response.status(200).json(transformedPrice);
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