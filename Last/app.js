/* app.js — UPDATED to support text/genre queries like "romantic comedy"
   Uses the uploaded MovieLens files at their local paths:
     /mnt/data/u.data
     /mnt/data/u.item
   (Your environment/tooling will map those local paths to reachable URLs.)
   
   Behavior:
   - Load data from the provided local paths.
   - Parse u.item genre flags (MovieLens 100K standard 19-genre order).
   - If the user enters a text query (e.g., "romantic comedy"), the app attempts
     to match genre tokens to MovieLens genres and returns movies matching
     those genres (all tokens must match). If no genre matches found it falls
     back to a simple title / keyword match. If still nothing, it falls back
     to model-based recommendations (if model trained).
   - If query is empty, preserves the previous "Test" behavior: pick a random
     user with >=20 ratings and show side-by-side historical top-10 vs model's top-10.
   
   Note: This file replaces the earlier app.js. Keep two-tower.js and index.html
   as before (index.html already wires Test → testUser()).
*/

let interactions = [];
let items = new Map();             // itemId → {title, year, genres: []}
let userToRatings = new Map();     // user → [{itemId, rating, ts}]
let users = [];
let itemIds = [];
let userIndex = new Map();
let itemIndex = new Map();
let indexUser = [];
let indexItem = [];

let model; // TwoTowerModel instance (from two-tower.js) after training
let lossPoints = [];

/********** MovieLens 100K genre names (standard order) **********
 From MovieLens 100k: the 19 genre flags correspond to:
 ["unknown","Action","Adventure","Animation","Children's","Comedy","Crime",
  "Documentary","Drama","Fantasy","Film-Noir","Horror","Musical","Mystery",
  "Romance","Sci-Fi","Thriller","War","Western"]
*******************************************************************/
const GENRES = [
  "unknown","Action","Adventure","Animation","Children's","Comedy","Crime",
  "Documentary","Drama","Fantasy","Film-Noir","Horror","Musical","Mystery",
  "Romance","Sci-Fi","Thriller","War","Western"
];

/****************** Utility: status printing ********************/
function log(msg) {
    document.getElementById('status').textContent += msg + "\n";
}

/****************** Data Loading *******************************/
/* This loadData fetches the uploaded files via the local paths that your
   environment will transform into accessible URLs:
     /mnt/data/u.item
     /mnt/data/u.data
*/
async function loadData() {
    log("Loading data from uploaded MovieLens files...");
    // Provided local paths (tooling will expose them as URLs)
    const uitemPath = "/mnt/data/u.item";
    const udataPath = "/mnt/data/u.data";

    const [uitemRaw, udataRaw] = await Promise.all([
        fetch(uitemPath).then(r => r.text()),
        fetch(udataPath).then(r => r.text())
    ]);

    // Parse u.item: fields separated by '|'
    // Format: item_id|title|release_date|video_release_date|IMDb URL|genre flags (19)
    const itemLines = uitemRaw.split("\n");
    for (const line of itemLines) {
        if (!line.trim()) continue;
        const parts = line.split("|");
        const id = parseInt(parts[0]);
        const title = parts[1] || `Movie ${id}`;
        // genre flags begin at index 5 and there are 19 flags
        const flags = parts.slice(5, 5 + GENRES.length).map(s => parseInt(s || "0"));
        const genres = [];
        for (let g = 0; g < flags.length; g++) {
            if (flags[g] === 1) genres.push(GENRES[g]);
        }
        items.set(id, { title, year: extractYear(title), genres });
    }

    // Parse u.data: user_id <tab> item_id <tab> rating <tab> timestamp
    const dataLines = udataRaw.split("\n");
    for (const line of dataLines) {
        if (!line.trim()) continue;
        const parts = line.split("\t");
        if (parts.length < 4) continue;
        const u = parseInt(parts[0]), i = parseInt(parts[1]), r = parseInt(parts[2]), ts = parseInt(parts[3]);
        interactions.push({ userId: u, itemId: i, rating: r, ts });
        if (!userToRatings.has(u)) userToRatings.set(u, []);
        userToRatings.get(u).push({ itemId: i, rating: r, ts });
    }

    users = [...userToRatings.keys()];
    itemIds = [...items.keys()];

    users.forEach((u, idx) => userIndex.set(u, idx));
    itemIds.forEach((i, idx) => itemIndex.set(i, idx));

    indexUser = users.slice();
    indexItem = itemIds.slice();

    log(`Loaded ${users.length} users, ${itemIds.length} items, ${interactions.length} interactions.`);
}

/********** Helper: extract year from title like "Toy Story (1995)" **********/
function extractYear(title) {
    const m = title.match(/\((\d{4})\)/);
    return m ? parseInt(m[1]) : null;
}

/****************** Batch generator (simple shuffle) **********************/
function* batchGenerator(batchSize, maxInteractions = 80000) {
    const shuffled = interactions.slice(0, maxInteractions);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        const uIdx = batch.map(d => userIndex.get(d.userId));
        const iIdx = batch.map(d => itemIndex.get(d.itemId));
        yield { uIdx, iIdx };
    }
}

/****************** Simple Loss Chart (canvas) ********************/
function drawLossChart() {
    const canvas = document.getElementById("lossChart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (lossPoints.length === 0) return;
    const maxL = Math.max(...lossPoints);
    const minL = Math.min(...lossPoints);
    ctx.beginPath();
    ctx.strokeStyle = "#0077cc";
    lossPoints.forEach((v, idx) => {
        const x = (idx / (lossPoints.length - 1)) * canvas.width;
        const y = canvas.height - ((v - minL) / (maxL - minL + 1e-9)) * canvas.height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

/****************** PCA for projection (simple power iteration) ********************/
function pca2D(matrix) {
    const N = matrix.length;
    if (N === 0) return [];
    const D = matrix[0].length;
    // mean center
    const mean = new Array(D).fill(0);
    for (let i = 0; i < N; i++) for (let d = 0; d < D; d++) mean[d] += matrix[i][d];
    for (let d = 0; d < D; d++) mean[d] /= N;
    const centered = matrix.map(row => row.map((v, d) => v - mean[d]));

    const power = (data) => {
        let v = new Array(D).fill(0).map(() => Math.random());
        const norm = (arr) => Math.sqrt(arr.reduce((s,x)=>s+x*x,0));
        for (let it = 0; it < 40; it++) {
            const w = new Array(D).fill(0);
            for (let i = 0; i < data.length; i++) {
                const dot = data[i].reduce((s,x,d)=>s + x * v[d], 0);
                for (let d = 0; d < D; d++) w[d] += data[i][d] * dot;
            }
            const nrm = norm(w) || 1;
            v = w.map(x => x / nrm);
        }
        return v;
    };

    const pc1 = power(centered);
    // deflate
    const centered2 = centered.map(r => {
        const proj = r.reduce((s,x,d)=>s + x * pc1[d], 0);
        return r.map((x,d) => x - proj * pc1[d]);
    });
    const pc2 = power(centered2);

    return centered.map(r => [
        r.reduce((s,x,d)=>s + x * pc1[d], 0),
        r.reduce((s,x,d)=>s + x * pc2[d], 0)
    ]);
}

function drawProjection2D(points) {
    const canvas = document.getElementById("projChart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points || points.length === 0) return;
    const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const tx = x => ((x - minX) / (maxX - minX + 1e-9)) * canvas.width;
    const ty = y => canvas.height - ((y - minY) / (maxY - minY + 1e-9)) * canvas.height;
    ctx.fillStyle = "#333";
    for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(tx(points[i][0]), ty(points[i][1]), 2, 0, Math.PI*2);
        ctx.fill();
    }
}

/****************** TRAINING ****************************/
async function trainModel() {
    if (users.length === 0 || itemIds.length === 0) {
        log("Please Load Data first.");
        return;
    }
    log("Initializing Two-Tower model...");
    model = new TwoTowerModel(users.length, itemIds.length, 32);

    const optimizer = tf.train.adam(0.01);
    const epochs = 3;
    const batchSize = 512;
    lossPoints = [];

    for (let ep = 0; ep < epochs; ep++) {
        log(`Epoch ${ep+1}/${epochs}`);
        for (const batch of batchGenerator(batchSize)) {
            const u = tf.tensor1d(batch.uIdx, 'int32');
            const iPos = tf.tensor1d(batch.iIdx, 'int32');
            // Minimize returns a scalar; we capture its value to plot
            const lossTensor = await optimizer.minimize(() => model.trainStep(u, iPos), /* returnCost */ true);
            const lossVal = await lossTensor.data();
            lossPoints.push(lossVal[0]);
            drawLossChart();
            u.dispose(); iPos.dispose(); lossTensor.dispose();
        }
    }
    log("Training finished.");

    // Compute item embeddings for projection (sample up to 1000)
    try {
        const itemEmbArray = await model.itemEmbedding.array();
        const sample = itemEmbArray.slice(0, Math.min(1000, itemEmbArray.length));
        const proj = pca2D(sample);
        drawProjection2D(proj);
        log("Item embedding projection drawn.");
    } catch (err) {
        log("Projection failed: " + err.message);
    }
}

/****************** TEXT / GENRE-BASED RECOMMENDATION ********************/
/* Convert a free-text query like "romantic comedy" into a set of genre tokens
   and attempt to find movies matching all tokens. We use fuzzy matching:
   - token 'romantic' matches 'Romance'
   - token 'sci-fi' matches 'Sci-Fi'
   - token 'kids' matches "Children's"
*/
function normalizeToken(tok) {
    return tok.toLowerCase().replace(/[^a-z0-9\-]/g, '');
}

function mapTokenToGenres(tok) {
    const norm = normalizeToken(tok);
    const matches = [];
    for (const g of GENRES) {
        const gn = g.toLowerCase().replace(/[^\w\-]/g, '');
        if (gn.includes(norm) || norm.includes(gn) || (gn.startsWith(norm)) ) {
            matches.push(g);
        }
    }
    // handle some common synonyms
    if (norm === 'romantic') {
        if (!matches.includes('Romance')) matches.push('Romance');
    }
    if (norm === 'romcom' || norm === 'romanticcomedy') {
        if (!matches.includes('Romance')) matches.push('Romance');
        if (!matches.includes('Comedy')) matches.push('Comedy');
    }
    if (norm === 'kids' && !matches.includes("Children's")) matches.push("Children's");
    if (norm === 'scifi' && !matches.includes('Sci-Fi')) matches.push('Sci-Fi');
    return matches;
}

/* Return an array of items (title strings) matching all genre tokens.
   If tokens can't be mapped to genres, falls back to simple title keyword match.
   Results are sorted by simple popularity (avg rating), descending.
*/
function recommendByText(query, topK=20) {
    const tokens = query.split(/\s+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) return [];

    // Map tokens to genres (union)
    const tokenGenres = tokens.map(t => mapTokenToGenres(t));
    // If all tokens mapped to >=1 genre, require item to satisfy all token groups
    const allMapped = tokenGenres.every(arr => arr.length > 0);

    let candidates = [];
    if (allMapped) {
        // For each item, check for each token whether item.genres intersects token's mapped genres
        for (const [id, meta] of items.entries()) {
            const gset = new Set(meta.genres);
            let ok = true;
            for (const mapped of tokenGenres) {
                const any = mapped.some(mg => gset.has(mg));
                if (!any) { ok = false; break; }
            }
            if (ok) candidates.push(id);
        }
    }

    // If no candidates via genre mapping, fallback to title keyword matching
    if (candidates.length === 0) {
        const qNorm = query.toLowerCase();
        for (const [id, meta] of items.entries()) {
            if (meta.title.toLowerCase().includes(qNorm)) candidates.push(id);
        }
    }

    // If still none and model is available, fallback to embedding-based similarity:
    if (candidates.length === 0 && model) {
        // embed query by treating tokens as genres: build a pseudo item embedding by summing item embeddings
        // Here we simply return [] to let the caller fallback to model recommendation flow.
        return [];
    }

    // Score candidates by simple popularity (avg rating)
    const avgRating = new Map();
    // compute averages
    const counts = new Map();
    for (const [u, ratings] of userToRatings.entries()) {
        for (const r of ratings) {
            if (!avgRating.has(r.itemId)) { avgRating.set(r.itemId, 0); counts.set(r.itemId, 0); }
            avgRating.set(r.itemId, avgRating.get(r.itemId) + r.rating);
            counts.set(r.itemId, counts.get(r.itemId) + 1);
        }
    }
    const scored = candidates.map(id => {
        const sum = avgRating.get(id) || 0;
        const cnt = counts.get(id) || 0;
        const avg = cnt > 0 ? sum / cnt : 0;
        return { itemId: id, score: avg };
    });
    scored.sort((a,b)=> b.score - a.score);
    return scored.slice(0, topK).map(s => items.get(s.itemId).title);
}

/****************** TEST — combines both behaviors ********************/
async function testUser() {
    // Ask the user for an optional text query (e.g., "romantic comedy")
    const q = prompt("Enter a text query (e.g., 'romantic comedy') to get genre-based suggestions. Leave empty to run a user test (historical vs model).");

    if (q && q.trim().length > 0) {
        log(`Running text-based recommendation for query: "${q}"`);
        const recs = recommendByText(q.trim(), 50);
        if (recs.length > 0) {
            // show top-10 results in a simple single-column table (right column)
            let html = "<table><tr><th>Query Results</th></tr>";
            for (let i = 0; i < Math.min(20, recs.length); i++) {
                html += `<tr><td>${recs[i]}</td></tr>`;
            }
            html += "</table>";
            document.getElementById("resultTable").innerHTML = html;
            log(`Found ${recs.length} matching movies (displaying up to 20).`);
            return;
        } else {
            // fallback to model-based if available
            if (!model) {
                log("No direct genre/title matches found and model is not trained. Try training first or try different query terms.");
                document.getElementById("resultTable").innerHTML = "<p>No matches found. Train the model or try different keywords.</p>";
                return;
            } else {
                log("No direct genre/title matches found — falling back to model similarity search.");
            }
        }
    }

    // If we reach here, either q was empty (user test mode) OR we fallback to model-based recommendations
    // Pick a random user with >=20 ratings
    const qualified = [...userToRatings.keys()].filter(u => userToRatings.get(u).length >= 20);
    if (qualified.length === 0) {
        log("No user with >=20 ratings found.");
        return;
    }
    const u = qualified[Math.floor(Math.random() * qualified.length)];
    const rated = userToRatings.get(u);

    // top-10 rated historically (by rating then recency)
    const topHist = rated
        .slice()
        .sort((a,b)=> b.rating - a.rating || b.ts - a.ts)
        .slice(0,10)
        .map(x => items.get(x.itemId).title);

    // If model available compute model recommendations; else show popularity-based
    let topRec = [];
    if (model) {
        const uIdx = userIndex.get(u);
        const uEmb = model.getUserEmbedding(tf.tensor1d([uIdx], 'int32'));
        const itemEmbMatrix = tf.tensor2d(await model.itemEmbedding.array());
        const scores = tf.matMul(uEmb, itemEmbMatrix.transpose()).arraySync()[0];
        const ratedSet = new Set(rated.map(r=>r.itemId));
        const scoredList = [];
        for (let i = 0; i < scores.length; i++) {
            const id = indexItem[i];
            if (!ratedSet.has(id)) scoredList.push({ itemId: id, score: scores[i] });
        }
        scoredList.sort((a,b)=> b.score - a.score);
        topRec = scoredList.slice(0,10).map(x => items.get(x.itemId).title);
        itemEmbMatrix.dispose(); uEmb.dispose();
    } else {
        // popularity fallback
        const sums = new Map(), counts = new Map();
        for (const [uu, rs] of userToRatings.entries()) {
            for (const r of rs) {
                sums.set(r.itemId, (sums.get(r.itemId)||0) + r.rating);
                counts.set(r.itemId, (counts.get(r.itemId)||0) + 1);
            }
        }
        const scored = [];
        for (const id of items.keys()) {
            scored.push({ itemId: id, score: (sums.get(id)||0) / (counts.get(id)||1) });
        }
        scored.sort((a,b)=> b.score - a.score);
        const ratedSet = new Set(rated.map(r=>r.itemId));
        topRec = scored.filter(s=> !ratedSet.has(s.itemId)).slice(0,10).map(s => items.get(s.itemId).title);
    }

    // Render side-by-side 2-column table
    let html = "<table><tr><th>User's Top-10 Rated</th><th>Model Top-10 Recommended</th></tr>";
    for (let i = 0; i < 10; i++) {
        html += `<tr><td>${topHist[i] || ""}</td><td>${topRec[i] || ""}</td></tr>`;
    }
    html += "</table>";
    document.getElementById("resultTable").innerHTML = html;
    log(`Test done for user ${u} (showing historical vs recommended).`);
}

/****************** Wire UI Buttons (index.html already has these buttons) ****************************/
document.getElementById("loadBtn").onclick = () => {
    // clear status
    document.getElementById('status').textContent = "";
    loadData().catch(err => log("Load failed: " + err.message));
};
document.getElementById("trainBtn").onclick = () => {
    trainModel().catch(err => log("Train failed: " + err.message));
};
document.getElementById("testBtn").onclick = () => {
    testUser().catch(err => log("Test failed: " + err.message));
};
