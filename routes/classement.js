function countOccurrences(text, keyword) {
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

function calculatePageRank(links, dampingFactor = 0.85, epsilon = 0.0001, maxIterations = 100) {
    const nodes = {};
    links.forEach(([from, to]) => {
        if (!nodes[from]) nodes[from] = { out: [], in: [] };
        if (!nodes[to]) nodes[to] = { out: [], in: [] };
        nodes[from].out.push(to);
        nodes[to].in.push(from);
    });

    const nodeIds = Object.keys(nodes);
    const numNodes = nodeIds.length;
    const ranks = {};
    nodeIds.forEach(id => {
        ranks[id] = 1 / numNodes;
    });

    for (let i = 0; i < maxIterations; i++) {
        const newRanks = {};
        let diff = 0;
        nodeIds.forEach(id => {
            let rankSum = 0;
            nodes[id].in.forEach(inId => {
                rankSum += ranks[inId] / nodes[inId].out.length;
            });
            newRanks[id] = (1 - dampingFactor) / numNodes + dampingFactor * rankSum;
            diff += Math.abs(newRanks[id] - ranks[id]);
        });
        if (diff < epsilon) break;
        Object.assign(ranks, newRanks);
    }

    return ranks;
}

function rankByRelevance(results, query) {
    results.forEach(book => {
        const occurrences = countOccurrences(book.title, query) +
                            countOccurrences(book.summary, query) +
                            countOccurrences(book.content, query);
        book.relevanceScore = occurrences;
    });

    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results;
}

module.exports = {
    countOccurrences,
    calculatePageRank,
    rankByRelevance
};