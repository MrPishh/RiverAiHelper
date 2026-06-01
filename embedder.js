require('dotenv').config();

const PROVIDER = (process.env.EMBEDDING_PROVIDER || 'voyage').toLowerCase();

// embed(texts: string[]) → float[][]
async function embed(texts) {
    if (!Array.isArray(texts)) texts = [texts];
    switch (PROVIDER) {
        case 'voyage': return embedVoyage(texts);
        default: throw new Error(`Unknown EMBEDDING_PROVIDER: "${PROVIDER}". Supported: voyage`);
    }
}

async function embedVoyage(texts, retries = 5) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error('VOYAGE_API_KEY is not set in .env');

    const fetch = (await import('node-fetch')).default;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch('https://api.voyageai.com/v1/embeddings', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body:    JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
        });

        if (res.ok) {
            const data = await res.json();
            return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
        }

        if (res.status === 429 && attempt < retries) {
            const wait = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s, 16s, 32s
            console.warn(`[Embedder] Rate limited — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
        }

        const err = await res.text();
        throw new Error(`Voyage API error ${res.status}: ${err}`);
    }
}

module.exports = { embed };
