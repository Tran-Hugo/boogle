const { Router } = require('express');
const { books, sequelize } = require('../models');
const { Op } = require('sequelize');

const router = Router();

async function searchBooks(query) {
    const lowerCaseQuery = query.toLowerCase();
    return await books.findAll({
        where: {
            [Op.or]: [
                { title: { [Op.like]: `%${lowerCaseQuery}%` } },
                { summary: { [Op.like]: `%${lowerCaseQuery}%` } }
            ]
        }
    });
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

module.exports = router;