const { Router } = require('express');
const { books, invertedIndexing, tf_idfs, book_recommendations } = require('../models');
const { Op } = require('sequelize');
const Trie = require('mnemonist/trie');
const natural = require('natural');
const { all } = require('axios');
const levenshtein = natural.LevenshteinDistance;

const router = Router();

async function suggestTerm(query) {
    const terms = await invertedIndexing.findAll({attributes: ['term']});
    
    const suggestions = terms.map(term => {
        return {
            term: term.term,
            distance: levenshtein(query, term.term)
        }
    });

    suggestions.sort((a, b) => a.distance - b.distance);
    return suggestions[0].term;
}

// Créer un nouveau Trie
const trie = new Trie();

// Remplir le Trie avec les termes de la table invertedIndexing
async function populateTrie() {
    console.log("populating trie");
    const allTerms = await invertedIndexing.findAll({ attributes: ['term'] });
    console.log(allTerms.length);
    
    allTerms.forEach(term => {
        trie.add(term.term.toLowerCase());
    });
    console.log("done populating trie");
}

// Appeler la fonction pour remplir le Trie
populateTrie();

router.get('/debug/trie', (req, res) => {
    const terms = [];
    for (const key of trie.keys()) {
        terms.push(key);
    }
    res.status(200).json(terms);
});

// Fonction pour récupérer les suggestions d'autocomplétion
function getAutocompleteSuggestions(trie, prefix) {
    const suggestions = [];
    const node = trie.find(prefix);

    if (node) {
        const stack = [{ node, prefix }];
        while (stack.length > 0 && suggestions.length < 5) {
            const { node: currentNode, prefix: currentPrefix } = stack.pop();
            suggestions.push(currentNode);
            if (currentNode.children) {
                for (const [key, child] of currentNode.children.entries()) {
                    stack.push({ node: child, prefix: currentPrefix + key });
                }
            }
        }
    }

    return suggestions;
}


// Route pour l'autocomplétion
router.get('/autocomplete', (req, res) => {
    const prefix = req.query.prefix;
    if (!prefix) {
        return res.status(400).send('Bad Request: prefix parameter is required');
    }

    const suggestions = getAutocompleteSuggestions(trie, prefix.toLowerCase());
    res.status(200).json(suggestions);
});

async function searchBooks(query, res) {
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

    let booksIds = books_list.stats.sort((a, b) => b.count - a.count).map(rec => rec.id).slice(0, 20);
    
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
    
    const tfidfCoeff = 0.5;
    const scoreCoeff = 0.5;

    const maxTfidf = Math.max(...results.map(book => books_list.stats.find(rec => String(rec.id) === String(book.id))?.score ?? 0));
    const maxScore = Math.max(...results.map(book => book.score));

    books_list = results.map(book => {
        const match = books_list.stats.find(rec => String(rec.id) === String(book.id));
        
        const bookTfidf = match?.score ?? 0;
        const bookScore = book.score;

        const normTfidf = maxTfidf ? bookTfidf / maxTfidf : 0;
        const normScore = maxScore ? bookScore / maxScore : 0;

        const final_score = (tfidfCoeff * normTfidf) + (scoreCoeff * normScore);

        return {
            ...book.dataValues,
            final_score
        };
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

async function advancedSearchBooks(regex, res) {
    const regexPattern = new RegExp(regex, 'i');
    const sqlRegex = regex.replace(/\./g, '%');
    const matchingTerms = await invertedIndexing.findAll({
        where: { term: { [Op.like]: `${sqlRegex}%` } } 
    });

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
        const results = await advancedSearchBooks(regex, res);
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;