// script.js
// Lightweight Two-Tower + MLP demo using the data parsed in data.js
let model = null;
let baselineEmbUser = null; // used for simple baseline dot-product (user features -> dot with item emb)
let itemFeatureMatrix = null; // JS array [numItems][4]
let userFeatureArray = null;  // JS array [numUsers][6]

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('btn-load').onclick = async ()=>{
    document.getElementById('status').innerText = 'Loading data...';
    const ok = await loadData();
    if (!ok) return;
    itemFeatureMatrix = getItemFeaturesMatrix();
    userFeatureArray = buildUserFeatureArray();
    document.getElementById('status').innerText = `Loaded ${numUsers} users and ${numMealPlans} meal plans.`;
    log(`Meal plans: ${indexToMealPlan.join(', ')}`);
    document.getElementById('btn-train').disabled = false;
  };
  document.getElementById('btn-train').onclick = trainHandler;
  document.getElementById('btn-test').onclick = testHandler;
});

function log(msg){ const el=document.getElementById('log'); el.textContent += msg+'\n'; el.scrollTop = el.scrollHeight; }

// Minimal twoTower class using tfjs layers inside script for simplicity
function createTwoTower(numUsersLocal, numItemsLocal, userFeatDim, itemFeatDim, embDim, useMLP){
  // Inputs are numeric user feature vectors and item feature vectors (we will feed them directly)
  const userInput = tf.input({shape:[userFeatDim], name:'userInput'}); // continuous vector
  const itemInput = tf.input({shape:[itemFeatDim], name:'itemInput'});

  // simple dense projections to latent space
  const userDense = tf.layers.dense({units:embDim, activation:'relu'}).apply(userInput); // [batch,embDim]
  let itemDense = tf.layers.dense({units:embDim, activation:'relu'}).apply(itemInput);

  if (useMLP){
    // deeper MLP on concatenated user+item (for Deep variant, we create another head)
    const concat = tf.layers.concatenate().apply([userDense, itemDense]);
    const h1 = tf.layers.dense({units: Math.max(16, embDim*2), activation:'relu'}).apply(concat);
    const h2 = tf.layers.dense({units: embDim, activation:'linear'}).apply(h1);
    // final score is dot between userDense and h2
    const score = tf.layers.dot({axes:1}).apply([userDense, h2]);
    const output = tf.layers.activation({activation:'linear'}).apply(score);
    const mdl = tf.model({inputs:[userInput, itemInput], outputs:output});
    return mdl;
  } else {
    const score = tf.layers.dot({axes:1}).apply([userDense, itemDense]); // [batch,1]
    const out = tf.layers.activation({activation:'linear'}).apply(score);
    const mdl = tf.model({inputs:[userInput, itemInput], outputs:out});
    return mdl;
  }
}

async function trainHandler(){
  document.getElementById('btn-train').disabled = true;
  document.getElementById('status').innerText = 'Preparing training data...';
  const dim = parseInt(document.getElementById('cfg-dim').value||'32',10);
  const epochs = parseInt(document.getElementById('cfg-epochs').value||'6',10);
  const batchSize = parseInt(document.getElementById('cfg-bsz').value||'128',10);
  const useMLP = document.getElementById('cfg-mlp').checked;

  // Build training examples: each user has positive item = their Recommended_Meal_Plan
  const userXs = []; const itemXs = []; const labels = [];
  for (let i=0;i<users.length;i++){
    const ufeat = userFeatureArray[i];
    const planName = users[i].Recommended_Meal_Plan;
    const itemIdx = mealPlanToIndex[planName];
    if (itemIdx===undefined) continue;
    userXs.push(ufeat);
    itemXs.push(itemFeatureMatrix[itemIdx]);
    labels.push(1); // positive
  }

  // We'll generate in-batch negatives by pairing each user with other items inside batch and use softmax-like training.
  // For simplicity we will train with regression MSE on positive pairs only (demonstration). For stronger result implement sampled-softmax or BPR.
  model = createTwoTower(numUsers, numMealPlans, userFeatureArray[0].length, itemFeatureMatrix[0].length, dim, useMLP);
  model.compile({optimizer: tf.train.adam(0.001), loss: 'meanSquaredError'});

  document.getElementById('status').innerText = 'Training model (this runs in-browser)...';
  log('Starting training...');
  const userTensor = tf.tensor2d(userXs);
  const itemTensor = tf.tensor2d(itemXs);
  const labelTensor = tf.tensor2d(labels, [labels.length,1]);

  // Train for a few epochs
  await model.fit([userTensor, itemTensor], labelTensor, {
    epochs,
    batchSize,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        log(`Epoch ${epoch+1}/${epochs} loss=${(logs.loss||0).toFixed(4)}`);
        drawLossPoint(logs.loss || 0);
        await tf.nextFrame();
      }
    }
  });

  userTensor.dispose(); itemTensor.dispose(); labelTensor.dispose();
  document.getElementById('status').innerText = 'Training complete.';
  log('Training finished.');
  document.getElementById('btn-test').disabled = false;

  // create baseline user emb by a linear projection of user features for dot baseline
  baselineEmbUser = tf.tidy(()=> tf.layers.dense({units:dim, activation:'linear'}).apply(tf.tensor2d(userFeatureArray)));
}

function drawLossPoint(loss){
  const canvas = document.getElementById('loss-canvas'); const ctx = canvas.getContext('2d');
  // simple append line plot (append center)
  // For brevity, repaint simple min/max scaled line
  if (!window.__lossHistory) window.__lossHistory=[];
  window.__lossHistory.push(loss);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0b0b0b'; ctx.fillRect(0,0,canvas.width,canvas.height);
  if (window.__lossHistory.length<2) return;
  const arr=window.__lossHistory; const max=Math.max(...arr); const min=Math.min(...arr);
  ctx.strokeStyle='#46d369'; ctx.beginPath();
  for (let i=0;i<arr.length;i++){
    const x = 10 + (i/(arr.length-1))*(canvas.width-20);
    const y = canvas.height - 10 - ((arr[i]-min)/(max-min+1e-8))*(canvas.height-20);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

async function testHandler(){
  if (!model) { alert('train first'); return; }
  // pick a random user
  const uidx = Math.floor(Math.random()*users.length);
  const u = users[uidx];
  document.getElementById('status').innerText = `Testing for user ${u.id}`;
  log(`Testing for user id ${u.id}, recommended plan (ground truth): ${u.Recommended_Meal_Plan}`);

  // build user tensor and compute scores vs all items
  const ufeat = tf.tensor2d([userFeatureArray[uidx]]);
  // build items tensor
  const itemsT = tf.tensor2d(itemFeatureMatrix);
  // compute model scores for each item by running model on repeated user
  const repeatedUser = tf.tile(ufeat, [numMealPlans,1]); // [numItems, userFeatDim] => we need [numItems, userFeatDim]
  // But model expects shape [batch, userFeatDim] and [batch, itemFeatDim]
  const preds = model.predict([repeatedUser, itemsT]);
  const scores = await preds.data();
  // Build list of (plan, score), sort desc
  const arr = [];
  for (let i=0;i<numMealPlans;i++) arr.push({plan:indexToMealPlan[i], score:scores[i]});
  arr.sort((a,b)=> b.score - a.score);

  // baseline: simple dot between baselineEmbUser[uidx] and transformed item features (project item)
  let baselineArr = [];
  if (baselineEmbUser){
    const userEmb = await baselineEmbUser.array();
    const userVec = userEmb[uidx];
    // create simple linear projection for items (map itemFeatureMatrix via random weight to same dim)
    // for demo: compute dot(userVec, mean-centered item features projected)
    for (let i=0;i<numMealPlans;i++){
      // project item features to size of userVec by simple linear: replicate or pad
      const itemVec = itemFeatureMatrix[i];
      // compute simple similarity: negative euclidean for demo
      let s=0;
      for (let j=0;j<userVec.length && j<itemVec.length;j++) s -= Math.abs(userVec[j] - itemVec[j%itemVec.length]);
      baselineArr.push({plan:indexToMealPlan[i], score:s});
    }
    baselineArr.sort((a,b)=> b.score - a.score);
  }

  // Render table: left = ground-truth, middle = baseline top-5, right = model top-5
  renderComparison(uidx, arr.slice(0,10), baselineArr.slice(0,10));
  ufeat.dispose(); itemsT.dispose(); repeatedUser.dispose(); preds.dispose();
}

function renderComparison(uidx, modelTop, baselineTop){
  const wrap = document.getElementById('tables-wrap'); wrap.innerHTML = '';
  const tbl = document.createElement('table');
  const header = document.createElement('tr');
  header.innerHTML = `<th>Ground-truth Plan</th><th>Model Top-10 (MLP)</th><th>Baseline Top-10</th>`;
  tbl.appendChild(header);
  const truth = users[uidx].Recommended_Meal_Plan;
  for (let i=0;i<10;i++){
    const tr=document.createElement('tr');
    const left = (i===0)? `<strong>${escapeHtml(truth)}</strong>` : '';
    const mid = modelTop[i]? `${escapeHtml(modelTop[i].plan)} (${modelTop[i].score.toFixed(2)})` : '';
    const right = baselineTop[i]? `${escapeHtml(baselineTop[i].plan)} (${baselineTop[i].score.toFixed(2)})` : '';
    tr.innerHTML = `<td>${left}</td><td>${mid}</td><td>${right}</td>`;
    tbl.appendChild(tr);
  }
  wrap.appendChild(tbl);
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
