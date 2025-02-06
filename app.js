const express = require('express');
const app = express();
const port = 3000;

const books = require('./routes/books');
const search = require('./routes/search');
const { sequelize } = require('./models');

app.use('/api/books', books);
app.use('/api/search', search);

sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log('server on port 3000');
    });
});