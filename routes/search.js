const { Router } = require('express');
const { books, inverted_indexing } = require('../models');
const { Op } = require('sequelize');
const { rankByRelevance } = require('./classement');

const router = Router();

async function searchBooks(query) {
    const lowerCaseQuery = query.toLowerCase();
    const terms = await inverted_indexing.findAll({
        where: {
            term: { [Op.like]: `%${lowerCaseQuery}%` }
        }
    });

    const bookIds = terms.reduce((ids, term) => {
        return ids.concat(term.list.map(item => item.id));
    }, []);

    const results = await books.findAll({
        where: {
            id: { [Op.in]: bookIds }
        }
    });

    return rankByRelevance(results, query);
}

async function advancedSearchBooks(regex) {
    const regexPattern = new RegExp(regex, 'i');
    const terms = await inverted_indexing.findAll();

    const matchingTerms = terms.filter(term => regexPattern.test(term.term));
    const bookIds = matchingTerms.reduce((ids, term) => {
        return ids.concat(term.list.map(item => item.id));
    }, []);

    const results = await books.findAll({
        where: {
            id: { [Op.in]: bookIds }
        }
    });

    return rankByRelevance(results, regex);
}

router.get('/', async (req, res) => {
    const query = req.query.mot;
    if (!query) {
        return res.status(400).send('Bad Request: query parameter is required');
    }

    try {
        const results = await searchBooks(query);
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/advanced', async (req, res) => {
    const regex = req.query.regex;
    if (!regex) {
        return res.status(400).send('Bad Request: regex parameter is required');
    }

    try {
        const results = await advancedSearchBooks(regex);
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;