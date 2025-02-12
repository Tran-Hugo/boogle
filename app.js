const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000;

const books = require('./routes/books');
const search = require('./routes/search');
const { sequelize } = require('./models');

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(cors());

app.use(
    cors({
        origin: 'http://localhost:5173',
        methods: 'GET,POST,PUT,DELETE',
        allowedHeaders: 'Content-Type,Authorization',
    })
);

app.use('/api/books', books);
app.use('/api/search', search);

sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log('server on port 3000');
    });
});