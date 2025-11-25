/********************************************************************
 app.js — Controls UI, data loading, training loop, testing, PCA plot,
 and rendering tables.
********************************************************************/

let interactions = [];
let items = new Map();             // itemId → {title, year}
let userToRatings = new Map();     // user → [{itemId, rating, ts}]
let users = [];
let itemIds = [];
let userIndex = new Map();
let itemIndex = new Map();
let indexUser = [];
let indexItem = [];

let model;

// chart state
let lossPoints = [];

/****************** Utility: status printing ********************/
function log(msg) {
    document.getElementById('status').textContent += msg + "\n";
}

/****************** Data Loading *******************************/
async function loadData() {
    log("Loading data...");

    const udata = await fetch("data/u.data").then(r => r.text());
    const uitem = await fetch("data/u.item").then(r => r.text());

    // Parse u.item: item_id|title|release_date|...
    const itemLines = uitem.split("\n");
    for (const line of itemLines) {
        if (!line.trim()) continue;
        const parts = line.split("|");
        const id = parseInt(parts[0]);
        let title = parts[1];
        let year = null;
        const yrMatch = title.match(/\((\d{4})\)/);
        if (yrMatch) year = parseInt(yrMatch[1]);
        items.set(id, { title, year });
    }

    // Parse u.data: user_id, item_id, rating, timestamp
    const dataLines = udata.split("\n");
    for (const line of dataLines) {
        if (!line.trim()) continue;
        const [u, i, r, ts] = line.split("\t").map(Number);
        interactions.push({ userId: u, itemId: i, rating: r, ts });
        if (!userToRatings.has(u)) userToRatings.set(u, []);
        userToRatings.get(u).push({ itemId: i, rating: r, ts });
    }

    users = [...userToRatings.keys()];
    itemIds = [...items.keys()];

    // Build indexers
    users.forEach((u, idx) => userIndex.set(u, idx));
    itemIds.forEach((i, idx) => itemIndex.set(i, idx));

    indexUser = users.slice();
    indexItem = itemIds.slice();

    log(`Loaded ${users.length} users, ${itemIds.length} items, ${interactions.length} interactions.`);
}

/****************** Build Training Batches **********************/
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

/****************** Simple Canvas Line Plot ********************/
function drawLossChart() {
    const canvas = document.getElementById("lossChart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (lossPoints.length === 0) return;

    const maxL = Math.max(...lossPoints);
    const minL = Math.min(...lossPoints);

    ctx.beginPath();
    ctx.strokeStyle = "black";
    lossPoints.forEach((v, idx) => {
        const x = (idx / (lossPoints.length - 1)) * canvas.width;
        const y = canvas.height - ((v - minL) / (maxL - minL)) * canvas.height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

/****************** PCA 2D ********************/
function pca2D(matrix) {
    // matrix: N x D, return Nx2
    const X = matrix;
    const N = X.length;
    const D = X[0].length;

    // mean center
    const mean = new Array(D).fill(0);
    for (let i = 0; i < N; i++)
        for (let d = 0; d < D; d++)
            mean[d] += X[i][d];
    for (let d = 0; d < D; d++) mean[d] /= N;

    const centered = X.map(row => row.map((v, d) => v - mean[d]));

    // covariance approx via simple power iteration (find top2 PCs)
    function powerIter(dim) {
        let v = Array(dim).fill(0).map(() => Math.random());
        const norm = a => Math.sqrt(a.reduce((s,x)=>s+x*x,0));
        for (let iter = 0; iter < 30; iter++) {
            let w = Array(dim).fill(0);
            for (let i = 0; i < N; i++) {
                const dot = v.reduce((s,x,d)=>s + centered[i][d]*x, 0);
                for (let d = 0; d < dim; d++)
                    w[d] += centered[i][d] * dot;
            }
            const n = norm(w);
            v = w.map(x=>x/n);
        }
        return v;
    }

    const pc1 = powerIter(D);
    // deflate for pc2
    const centered2 = centered.map(r=>{
        const dot = r.reduce((s,x,d)=>s+x*pc1[d],0);
        return r.map((x,d)=>x - dot*pc1[d]);
    });
    const pc2 = powerIter(D);

    const pc1Mat = pc1;
    const pc2Mat = pc2;

    const out = centered.map(row => {
        const x = row.reduce((s,x,d)=>s + x * pc1Mat[d], 0);
        const y = row.reduce((s,x,d)=>s + x * pc2Mat[d], 0);
        return [x, y];
    });
    return out;
}

function drawProjection2D(points, sampleItems) {
    const canvas = document.getElementById("projChart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    function tx(x) { return ((x - minX) / (maxX - minX)) * canvas.width; }
    function ty(y) { return canvas.height - ((y - minY) / (maxY - minY)) * canvas.height; }

    ctx.fillStyle = "black";
    for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(tx(points[i][0]), ty(points[i][1]), 2, 0, Math.PI*2);
        ctx.fill();
    }
}

/****************** Training ****************************/
async function trainModel() {
    log("Initializing model...");
    model = new TwoTowerModel(users.length, itemIds.length, 32);

    const optimizer = tf.train.adam(0.01);
    const epochs = 3;
    const batchSize = 512;

    lossPoints = [];

    for (let ep = 0; ep < epochs; ep++) {
        log(`Epoch ${ep+1}/${epochs}...`);
        for (const batch of batchGenerator(batchSize)) {
            const u = tf.tensor1d(batch.uIdx, 'int32');
            const iPos = tf.tensor1d(batch.iIdx, 'int32');
            const lossVal = await optimizer.minimize(() => model.trainStep(u, iPos), true).data();
            lossPoints.push(lossVal[0]);
            drawLossChart();
            u.dispose();
            iPos.dispose();
        }
    }
    log("Training completed.");

    // draw item embedding PCA
    log("Computing PCA for item embeddings...");
    const itemEmb = await model.itemEmbedding.array();
    const sampleSize = Math.min(1000, itemEmb.length);
    const sample = itemEmb.slice(0, sampleSize);
    const proj = pca2D(sample);
    drawProjection2D(proj, sample);

    log("Projection done.");
}

/****************** Test ****************************/
async function testUser() {
    log("Selecting random user...");

    const qualified = [...userToRatings.keys()].filter(
        u => userToRatings.get(u).length >= 20
    );

    const u = qualified[Math.floor(Math.random() * qualified.length)];
    const rated = userToRatings.get(u);

    // top-10 rated historically
    const topHist = rated
        .sort((a,b)=> b.rating - a.rating || b.ts - a.ts)
        .slice(0,10)
        .map(x => items.get(x.itemId).title);

    // get user embedding
    const uIdx = userIndex.get(u);
    const uEmb = model.getUserEmbedding(tf.tensor1d([uIdx], 'int32'));

    // compute scores vs all items
    const itemEmb = tf.tensor2d(await model.itemEmbedding.array());
    const scores = tf.matMul(uEmb, itemEmb.transpose()).arraySync()[0];

    const ratedSet = new Set(rated.map(r=>r.itemId));
    let scoredList = [];
    for (let i = 0; i < scores.length; i++) {
        const id = indexItem[i];
        if (!ratedSet.has(id)) {
            scoredList.push({ itemId: id, score: scores[i] });
        }
    }

    scoredList.sort((a,b)=> b.score - a.score);
    const topRec = scoredList.slice(0,10).map(x => items.get(x.itemId).title);

    // render table
    let html = "<table><tr><th>Top-10 Rated (User)</th><th>Top-10 Recommended (Model)</th></tr>";
    for (let i = 0; i < 10; i++) {
        html += `<tr><td>${topHist[i] || ""}</td><td>${topRec[i] || ""}</td></tr>`;
    }
    html += "</table>";
    document.getElementById("resultTable").innerHTML = html;

    log("Test done.");
}

/****************** Wire Up Buttons ****************************/
document.getElementById("loadBtn").onclick = loadData;
document.getElementById("trainBtn").onclick = trainModel;
document.getElementById("testBtn").onclick = testUser;
