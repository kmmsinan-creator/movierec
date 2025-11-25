app.js
/* app.js — Full client-side app for:
   - loading MovieLens 100K uploaded files at local paths (/mnt/data/u.item, /mnt/data/u.data)
   - train a minimal Two-Tower (in two-tower.js)
   - Search by text (e.g., "romantic comedy") using genre mapping + title fallback
   - Test mode: side-by-side user's top-10 rated vs model top-10 recommended

   Note: This file expects your environment to map the local uploaded paths into accessible URLs:
     /mnt/data/u.item
     /mnt/data/u.data

   Lecture slides used for architecture guidance: :contentReference[oaicite:1]{index=1}
*/

/* ------------------------
   Global state and helpers
   ------------------------ */
const GENRES = [
  "unknown","Action","Adventure","Animation","Children's","Comedy","Crime",
  "Documentary","Drama","Fantasy","Film-Noir","Horror","Musical","Mystery",
  "Romance","Sci-Fi","Thriller","War","Western"
];

let interactions = [];
let items = new Map();            // itemId -> {title, year, genres}
let userToRatings = new Map();    // userId -> [{itemId, rating, ts}]
let users = [], itemIds = [];
let userIndex = new Map(), itemIndex = new Map();
let indexUser = [], indexItem = [];

let model = null;                 // TwoTowerModel instance (after training)
let lossPoints = [];

/* status logger */
function log(msg) {
  const s = document.getElementById('status');
  s.textContent = (s.textContent ? s.textContent + '\n' : '') + msg;
}

/* ------------------------
   Load Data
   ------------------------ */
async function loadData() {
  // Clear prior
  interactions = [];
  items = new Map();
  userToRatings = new Map();
  users = []; itemIds = [];
  userIndex.clear(); itemIndex.clear();
  indexUser = []; indexItem = [];
  document.getElementById('resultTable').innerHTML = "";
  document.getElementById('status').textContent = "Loading data...";

  // Local uploaded file paths — your environment/tooling will transform these to accessible URLs
  const uitemPath = "/mnt/data/u.item";
  const udataPath = "/mnt/data/u.data";

  try {
    const [uitemTxt, udataTxt] = await Promise.all([
      fetch(uitemPath).then(r => r.text()),
      fetch(udataPath).then(r => r.text())
    ]);

    // parse u.item
    const linesItem = uitemTxt.split('\n');
    for (const line of linesItem) {
      if (!line.trim()) continue;
      // item_id|title|release_date|video_release_date|IMDb_URL|19 genre flags...
      const parts = line.split("|");
      const id = parseInt(parts[0]);
      if (isNaN(id)) continue;
      const title = parts[1] || (`Movie ${id}`);
      const flags = parts.slice(5, 5 + GENRES.length).map(x => parseInt(x || "0"));
      const genres = [];
      for (let i = 0; i < flags.length; i++) if (flags[i] === 1) genres.push(GENRES[i]);
      items.set(id, { title, year: extractYear(title), genres });
    }

    // parse u.data
    const linesData = udataTxt.split('\n');
    for (const line of linesData) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
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
  } catch (err) {
    log("Error loading data: " + err.message);
    throw err;
  }
}

/* Extract year from title if present */
function extractYear(title) {
  const m = title.match(/\((\d{4})\)/);
  return m ? parseInt(m[1]) : null;
}

/* ------------------------
   Batch generator for training
   ------------------------ */
function* batchGenerator(batchSize = 512, maxInteractions = 80000) {
  const arr = interactions.slice(0, maxInteractions);
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  for (let i = 0; i < arr.length; i += batchSize) {
    const batch = arr.slice(i, i + batchSize);
    const uIdx = batch.map(x => userIndex.get(x.userId));
    const iIdx = batch.map(x => itemIndex.get(x.itemId));
    yield { uIdx, iIdx };
  }
}

/* ------------------------
   Simple canvas line plot for loss
   ------------------------ */
function drawLossChart() {
  const canvas = document.getElementById('lossChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!lossPoints.length) return;
  const maxL = Math.max(...lossPoints);
  const minL = Math.min(...lossPoints);
  ctx.beginPath();
  ctx.strokeStyle = "#d6336c";
  lossPoints.forEach((v, idx) => {
    const x = idx / (lossPoints.length - 1) * canvas.width;
    const y = canvas.height - ( (v - minL) / (maxL - minL + 1e-9) ) * canvas.height;
    if (idx === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

/* ------------------------
   PCA 2D projection (power-iteration top2)
   ------------------------ */
function pca2D(matrix) {
  if (!matrix || matrix.length === 0) return [];
  const N = matrix.length;
  const D = matrix[0].length;
  // mean center
  const mean = new Array(D).fill(0);
  for (let i = 0; i < N; i++) for (let d = 0; d < D; d++) mean[d] += matrix[i][d];
  for (let d = 0; d < D; d++) mean[d] /= N;
  const centered = matrix.map(r => r.map((v,d) => v - mean[d]));

  const power = (data) => {
    let v = new Array(D).fill(0).map(() => Math.random());
    for (let it=0; it<40; it++) {
      const w = new Array(D).fill(0);
      for (let i=0;i<data.length;i++) {
        const dot = data[i].reduce((s,x,d) => s + x * v[d], 0);
        for (let d=0; d<D; d++) w[d] += data[i][d] * dot;
      }
      const norm = Math.sqrt(w.reduce((s,x)=>s + x*x,0)) || 1;
      v = w.map(x => x / norm);
    }
    return v;
  };

  const pc1 = power(centered);
  const centered2 = centered.map(r => {
    const proj = r.reduce((s,x,d) => s + x * pc1[d], 0);
    return r.map((x,d) => x - proj * pc1[d]);
  });
  const pc2 = power(centered2);
  return centered.map(r => [ r.reduce((s,x,d)=>s + x * pc1[d], 0), r.reduce((s,x,d)=>s + x * pc2[d], 0) ]);
}

function drawProjection2D(points) {
  const canvas = document.getElementById('projChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!points.length) return;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const tx = x => (x - minX) / (maxX - minX + 1e-9) * canvas.width;
  const ty = y => canvas.height - ( (y - minY) / (maxY - minY + 1e-9) * canvas.height );
  ctx.fillStyle = "#333";
  for (let i=0;i<points.length;i++) {
    ctx.beginPath();
    ctx.arc(tx(points[i][0]), ty(points[i][1]), 2, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ------------------------
   Train the Two-Tower model
   ------------------------ */
async function trainModel() {
  if (!users.length || !itemIds.length) { log("Please Load Data first."); return; }
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
      const lossT = await optimizer.minimize(() => model.trainStep(u, iPos), true);
      const lossVal = (await lossT.data())[0];
      lossPoints.push(lossVal);
      drawLossChart();
      u.dispose(); iPos.dispose(); lossT.dispose();
    }
  }
  log("Training complete.");

  try {
    const emb = await model.itemEmbedding.array();
    const sample = emb.slice(0, Math.min(1000, emb.length));
    const proj = pca2D(sample);
    drawProjection2D(proj);
    log("Item embedding PCA plotted.");
  } catch (err) {
    log("Projection error: " + err.message);
  }
}

/* ------------------------
   Utility: map tokens to genres (simple fuzzy)
   ------------------------ */
function normalizeToken(tok) {
  return tok.toLowerCase().replace(/[^a-z0-9\-]/g, '');
}
function mapTokenToGenres(tok) {
  const n = normalizeToken(tok);
  const matches = [];
  for (const g of GENRES) {
    const gn = g.toLowerCase().replace(/[^a-z0-9\-]/g,'');
    if (gn.includes(n) || n.includes(gn) || gn.startsWith(n) || n.startsWith(gn)) matches.push(g);
  }
  if (n === 'romcom' || n === 'romanticcomedy' || n === 'rom-com') {
    if (!matches.includes('Romance')) matches.push('Romance');
    if (!matches.includes('Comedy')) matches.push('Comedy');
  }
  if (n === 'scifi' && !matches.includes('Sci-Fi')) matches.push('Sci-Fi');
  if (n === 'kids' && !matches.includes("Children's")) matches.push("Children's");
  if (n === 'romantic') if (!matches.includes('Romance')) matches.push('Romance');
  return matches;
}

/* ------------------------
   recommendByText(query)
   - tries genre matching (all tokens must be satisfied)
   - falls back to title keyword matching
   - returns array of titles
   ------------------------ */
function recommendByText(query, topK=50) {
  const tokens = query.split(/\s+/).map(t => t.trim()).filter(Boolean);
  if (!tokens.length) return [];

  const mapped = tokens.map(t => mapTokenToGenres(t));
  const allMapped = mapped.every(arr => arr.length > 0);

  let candidates = [];
  if (allMapped) {
    for (const [id, meta] of items.entries()) {
      const set = new Set(meta.genres);
      let ok = true;
      for (const mapArr of mapped) {
        if (!mapArr.some(g => set.has(g))) { ok = false; break; }
      }
      if (ok) candidates.push(id);
    }
  }

  if (!candidates.length) {
    // title keyword fallback
    const qn = query.toLowerCase();
    for (const [id, meta] of items.entries()) {
      if (meta.title.toLowerCase().includes(qn)) candidates.push(id);
    }
  }

  // Score by popularity (average rating); compute averages
  const sums = new Map(), counts = new Map();
  for (const [u, rs] of userToRatings.entries()) {
    for (const r of rs) {
      sums.set(r.itemId, (sums.get(r.itemId)||0) + r.rating);
      counts.set(r.itemId, (counts.get(r.itemId)||0) + 1);
    }
  }
  const scored = candidates.map(id => ({ id, score: (sums.get(id)||0) / (counts.get(id)||1) }));
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK).map(s => items.get(s.id).title);
}

/* ------------------------
   runSearchQuery — called by Search button
   ------------------------ */
async function runSearchQuery(query) {
  document.getElementById('resultTable').innerHTML = "";
  log(`Search: "${query}"`);
  const recs = recommendByText(query, 50);
  if (recs.length > 0) {
    let html = "<table><tr><th>Search Results</th></tr>";
    for (let i = 0; i < Math.min(20, recs.length); i++) {
      html += `<tr><td>${recs[i]}</td></tr>`;
    }
    html += "</table>";
    document.getElementById('resultTable').innerHTML = html;
    log(`Found ${recs.length} matches (displayed up to 20).`);
    return;
  }

  // fallback to model-based (if trained)
  if (!model) {
    document.getElementById('resultTable').innerHTML = "<p>No direct matches found. Train model or try different query.</p>";
    log("No direct matches and model not trained.");
    return;
  }

  log("No direct matches — using model-based similarity (approx).");
  // We don't have an LLM to encode free-text; use a heuristic:
  // Find items that match tokens, then rank by embedding similarity to those items.
  // Build a seed set of items by title keyword (looser)
  const qn = query.toLowerCase();
  const seedIds = [];
  for (const [id, meta] of items.entries()) {
    if (meta.title.toLowerCase().includes(qn)) seedIds.push(id);
  }
  // if none, use genre-match partial tokens
  if (!seedIds.length) {
    const toks = query.split(/\s+/).map(t => t.trim()).filter(Boolean);
    for (const t of toks) {
      const mapped = mapTokenToGenres(t);
      for (const [id, meta] of items.entries()) {
        if (mapped.some(g => meta.genres.includes(g))) seedIds.push(id);
      }
    }
  }
  // if still none, fallback to top popularity
  if (!seedIds.length) {
    const sums = new Map(), counts = new Map();
    for (const [u, rs] of userToRatings.entries()) for (const r of rs) {
      sums.set(r.itemId, (sums.get(r.itemId)||0) + r.rating);
      counts.set(r.itemId, (counts.get(r.itemId)||0) + 1);
    }
    const pop = [];
    for (const id of items.keys()) pop.push({ id, score: (sums.get(id)||0)/(counts.get(id)||1) });
    pop.sort((a,b)=> b.score - a.score);
    seedIds.push(...pop.slice(0,10).map(x=>x.id));
  }

  // Compute embedding centroid of seeds and score all items by cosine
  const itemEmbArray = await model.itemEmbedding.array();
  const seedIdxs = seedIds.map(sid => itemIndex.get(sid)).filter(x => x !== undefined);
  if (!seedIdxs.length) {
    document.getElementById('resultTable').innerHTML = "<p>No seeds found for model-based fallback.</p>";
    return;
  }
  // centroid
  const D = itemEmbArray[0].length;
  const centroid = new Array(D).fill(0);
  for (const si of seedIdxs) {
    const vec = itemEmbArray[si];
    for (let d = 0; d < D; d++) centroid[d] += vec[d];
  }
  for (let d=0; d<D; d++) centroid[d] /= seedIdxs.length;
  const normCent = Math.sqrt(centroid.reduce((s,x)=>s + x*x,0)) || 1;
  for (let d=0; d<D; d++) centroid[d] /= normCent;

  const scored = [];
  for (let i = 0; i < itemEmbArray.length; i++) {
    const vec = itemEmbArray[i];
    const normVec = Math.sqrt(vec.reduce((s,x)=>s + x*x,0)) || 1;
    let dot = 0;
    for (let d=0; d<D; d++) dot += (vec[d]/normVec) * centroid[d];
    scored.push({ id: indexItem[i], score: dot });
  }
  scored.sort((a,b)=> b.score - a.score);
  let html = "<table><tr><th>Model-Based Results</th></tr>";
  for (let i=0;i<20;i++) html += `<tr><td>${items.get(scored[i].id).title}</td></tr>`;
  html += "</table>";
  document.getElementById('resultTable').innerHTML = html;
  log("Model-based results shown.");
}

/* ------------------------
   Test: random user with >=20 ratings (side-by-side)
   ------------------------ */
async function testUser() {
  if (!users.length) { log("Please Load Data first."); return; }
  const qualified = [...userToRatings.keys()].filter(u => userToRatings.get(u).length >= 20);
  if (!qualified.length) { log("No user with >=20 ratings found."); return; }
  const user = qualified[Math.floor(Math.random() * qualified.length)];
  const rated = userToRatings.get(user);

  const topHist = rated.slice().sort((a,b) => b.rating - a.rating || b.ts - a.ts).slice(0,10).map(r => items.get(r.itemId).title);

  let topRec = [];
  if (model) {
    const uIdx = userIndex.get(user);
    const uEmb = model.getUserEmbedding(tf.tensor1d([uIdx], 'int32'));
    const itemMat = tf.tensor2d(await model.itemEmbedding.array());
    const scores = tf.matMul(uEmb, itemMat.transpose()).arraySync()[0];
    const ratedSet = new Set(rated.map(r => r.itemId));
    const scoredList = [];
    for (let i=0;i<scores.length;i++) {
      const id = indexItem[i];
      if (!ratedSet.has(id)) scoredList.push({ id, score: scores[i] });
    }
    scoredList.sort((a,b)=> b.score - a.score);
    topRec = scoredList.slice(0,10).map(x => items.get(x.id).title);
    itemMat.dispose(); uEmb.dispose();
  } else {
    // popularity fallback
    const sums = new Map(), counts = new Map();
    for (const [u, rs] of userToRatings.entries()) for (const r of rs) {
      sums.set(r.itemId, (sums.get(r.itemId)||0) + r.rating);
      counts.set(r.itemId, (counts.get(r.itemId)||0) + 1);
    }
    const scored = [];
    for (const id of items.keys()) scored.push({ id, score: (sums.get(id)||0)/(counts.get(id)||1) });
    scored.sort((a,b)=> b.score - a.score);
    const ratedSet = new Set(rated.map(r => r.itemId));
    topRec = scored.filter(s => !ratedSet.has(s.id)).slice(0,10).map(s => items.get(s.id).title);
  }

  let html = "<table><tr><th>User's Top-10 Rated</th><th>Model Top-10 Recommended</th></tr>";
  for (let i=0;i<10;i++) html += `<tr><td>${topHist[i] || ""}</td><td>${topRec[i] || ""}</td></tr>`;
  html += "</table>";
  document.getElementById('resultTable').innerHTML = html;
  log(`Test for user ${user} completed.`);
}

/* ------------------------
   Wire buttons
   ------------------------ */
document.getElementById('loadBtn').onclick = async () => {
  document.getElementById('status').textContent = "";
  try { await loadData(); } catch (e) { console.error(e); }
};
document.getElementById('trainBtn').onclick = async () => {
  try { await trainModel(); } catch (e) { log("Train failed: " + e.message); }
};
document.getElementById('testBtn').onclick = async () => {
  try { await testUser(); } catch (e) { log("Test failed: " + e.message); }
};
document.getElementById('searchBtn').onclick = async () => {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) {
    document.getElementById('resultTable').innerHTML = "<p>Please type a search query (e.g., 'romantic comedy').</p>";
    return;
  }
  try { await runSearchQuery(q); } catch (e) { log("Search failed: " + e.message); }
};
