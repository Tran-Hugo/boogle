const express = require('express')
const app = express()
const port = 3000

const books = require("./routes/books");
app.use("/api/books", books);
const models = require('./models');

models.sequelize.sync().then(() => {
    app.listen(port, ()=>{
        console.log('server on port 3000');
    })
});
