const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const natural = require('natural');

class BookService {
    static async fetch_content(formats) {
        let texte = null;
        let html = null;
    
        for (const format in formats) {
            if (format.includes('text/plain')) texte = formats[format];
            if (format.includes('text/html')) html = formats[format];
        }
    
        if (texte !== null) {
            const { data } = await axios.get(texte);
            return data;
        }
    
        // Html to text
        const { data } = await axios.get(html);
        
        const $ = cheerio.load(data);
        const text = $('body').text().trim();
        return text;
    }

    static async fetch_image(formats, title) {
        const FORMATS = ['image/jpeg', 'image/png'];
        let image = null;
    
        for (const format in formats) {
            if (FORMATS.includes(format)) {
                image = formats[format];
                break;
            }
        }
    
        if (image === null) return null;
    
        const { data } = await axios.get(image, { responseType: 'arraybuffer' });
        const filename = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '-' + Date.now();
        const path = 'assets/images/' + filename + '.jpg';
        fs.writeFileSync(path, data, 'binary');
    
        return path;
    }

    static tokenize(text) {
        const tokenizer = new natural.WordTokenizer();
        return tokenizer.tokenize(text);
    }

    static computePageRank(matrix, dampingFactor = 0.85, maxIterations = 100, tolerance = 1e-6){
        const books = Object.keys(matrix);
        const n = books.length;

        let ranks = {};
        books.forEach(book => ranks[book] = 1 / n);

        for (let iter = 0; iter < maxIterations; iter++) {
            let newRanks = {};
            let diff = 0;
    
            books.forEach(book => {
                let sum = 0;
                books.forEach(otherBook => {
                    const outgoingLinks = matrix[otherBook] || [];
                    const link = outgoingLinks.find(rec => rec.id === book);
                    
                    if (link && !isNaN(link.probability)) {
                        sum += ranks[otherBook] * link.probability;
                    }
                });
    
                newRanks[book] = (1 - dampingFactor) / n + dampingFactor * sum;
                diff += Math.abs(newRanks[book] - ranks[book]);
            });
    
            ranks = newRanks;

            if (diff < tolerance) {
                console.log("converged after", iter, "iterations");
                break;
            }
        }
    
        return ranks;
    }
}

module.exports = BookService;