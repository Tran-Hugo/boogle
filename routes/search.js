const { Router } = require('express');
const { books, inverted_indexing, tf_idfs, book_recommendations } = require('../models');
const { Op } = require('sequelize');
const natural = require('natural');
const levenshtein = natural.LevenshteinDistance;

const router = Router();

async function suggestTerm(query) {
    const terms = await inverted_indexing.findAll({attributes: ['term']});
    
    const suggestions = terms.map(term => {
        return {
            term: term.term,
            distance: levenshtein(query, term.term)
        }
    });

    suggestions.sort((a, b) => a.distance - b.distance);
    return suggestions[0].term;
}

async function searchBooks(query,res) {
    let books_list = await tf_idfs.findOne({ where: { term: query } });

    if (books_list === null) {
        const termSuggestion = await suggestTerm(query);
        try {
            res.status(200).json({ books: [], recommendations: [], termSuggestion: termSuggestion });
            return "No results found";
        } catch (error) {
            console.error(error);
        }
    }

    let booksIds = books_list.stats.sort((a, b) => b.count - a.count).map(rec => rec.id).slice(0, 10);
    
    const results = await books.findAll({
        where: { id: booksIds },
        attributes: ['id', 'title', 'authors', 'content', 'score', 'image']
    });

    results.forEach(book => {
        const index = book.content.toLowerCase().indexOf(query);
        const start = Math.max(0, index - 200);
        const end = Math.min(book.content.length, index + 200);
        book.content = book.content.slice(start, end) + '...';
    });
    
    const tfidfCoeff = 0.7;
    const scoreCoeff = 0.3;

    books_list = results.map(book => {
        const match = books_list.stats.find(rec => String(rec.id) === String(book.id));
        const bookTfidf = match?.count ?? 0;
        const bookScore = book.score;

        return {
        ...book.dataValues,
        final_score: (tfidfCoeff * bookTfidf) + (scoreCoeff * bookScore)
        }
    });

    books_list.sort((a, b) => b.final_score - a.final_score);

    let recommendations = await book_recommendations.findOne({ where: { book_id: books_list[0].id,  } });
    recommendations = recommendations.recommendations.sort((a, b) => b.score - a.score).map(rec => rec.id).slice(0, 5);
    recommendations = await books.findAll({ where: { id: recommendations }, attributes: ['id', 'title', 'authors', 'score', 'image'] });
    recommendations = recommendations.sort((a, b) => b.page_rank - a.page_rank);

    response = {
        books: books_list,
        recommendations: recommendations
    }
    return response;
}

async function advancedSearchBooks(regex, res) {
    const regexPattern = new RegExp(regex, 'i');
    const terms = await inverted_indexing.findAll();

    const matchingTerms = terms.filter(term => regexPattern.test(term.term));
    const bookIds = matchingTerms.reduce((ids, term) => {
        return ids.concat(term.list.map(item => item.id));
    }, []);

    const results = await books.findAll({
        where: {
            id: { [Op.in]: bookIds }
        },
        attributes: ['id', 'title', 'authors', 'content', 'score', 'image']
    });

    results.forEach(book => {
        const index = book.content.toLowerCase().search(regexPattern);
        const start = Math.max(0, index - 200);
        const end = Math.min(book.content.length, index + 200);
        book.content = book.content.slice(start, end) + '...';
    });

    const tfidfCoeff = 0.7;
    const scoreCoeff = 0.3;

    let books_list = results.map(book => {
        const match = matchingTerms.find(term => term.list.some(item => item.id === book.id));
        const bookTfidf = match ? match.list.find(item => item.id === book.id).count : 0;
        const bookScore = book.score;

        return {
            ...book.dataValues,
            final_score: (tfidfCoeff * bookTfidf) + (scoreCoeff * bookScore)
        }
    });

    books_list.sort((a, b) => b.final_score - a.final_score);

    let recommendations = await book_recommendations.findOne({ where: { book_id: books_list[0].id } });
    recommendations = recommendations.recommendations.sort((a, b) => b.score - a.score).map(rec => rec.id).slice(0, 5);
    recommendations = await books.findAll({ where: { id: recommendations }, attributes: ['id', 'title', 'authors', 'score', 'image'] });
    recommendations = recommendations.sort((a, b) => b.page_rank - a.page_rank);

    response = {
        books: books_list,
        recommendations: recommendations
    }
    return response;
}

router.get('/', async (req, res) => {
    let query = req.query.mot;
    if (!query) {
        return res.status(400).send('Bad Request: query parameter is required');
    }
    query = query.toLowerCase();
    try {
        const results = await searchBooks(query, res);
        if (results === "No results found") {
            return;
        }
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