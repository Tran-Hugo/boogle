const { Router } = require('express');
const axios = require('axios');

const { books, inverted_indexing } = require('../models');
const BookService = require('../services/book');

const router = Router();

router.get('/fetch', async (req, res) => {
    const page = req.query.page;
    if (page === undefined) {
        res.status(400).send('Bad Request: page is required');
    }

    try {
        // const { data } = await axios.get(process.env.GUTENDEX_API + '/books?languages=en&mime_type=text/plain&page=' + page);


        // Mock data
        const data = require('../assets/books.json');

        // data.results = data.results.slice(0, 1);


        for (const item of data.results) {
            const summary = item.summaries[0];
            const content = await BookService.fetch_content(item.formats);
            const image = await BookService.fetch_image(item.formats, item.title);
            
            let book = {
                title: item.title,
                authors: item.authors,
                summary: summary,
                content: content,
                image: image,
            };
            book = await books.create(book);

            const tokens = BookService.tokenize(content);
            const indexes = {};
            for (let token of tokens) {
                token = token.toLowerCase();
                if (indexes[token] === undefined) indexes[token] = 1;
                else indexes[token]++;
            }

            for (const token in indexes) {
                console.log(inverted_indexing);
                const term = await inverted_indexing.findOne({ where: { term: token } });
                if (term === null) {
                    await inverted_indexing.create({
                        term: token,
                        list: [{
                            id: book.id,
                            count: indexes[token],
                        }],
                    });
                } else {
                    term.list = term.list.concat({
                        id: book.id,
                        count: indexes[token],
                    });
                    await term.save();
                }
            }
        }
        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', (req, res) => {
    const id = req.params.id;
    books.findByPk(id)
        .then(book => {
            if (book === null) {
                res.status(404).send('Book not found');
            } else {
                res.status(200).json(book);
            }
        })
        .catch(error => {
            res.status(500).json({ error: error.message });
        });
});

module.exports = router;