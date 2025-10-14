// script.js
// UI glue: rule-based recommendation + TensorFlow.js ML model (classification/ranking)
// Depends on data.js globals: users, mealPlans, mealPlanToIndex, indexToMealPlan, userFeatureArray, itemFeatureMatrix

let nutritionChart = null;
let lossChart = null;
let mlModel = null;
let historyLoss = [];

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('btn-load').onclick = async ()=> {
    document.getElementById('status').innerText = 'Loading dataset...';
    const ok = await loadDatasetCSV();
    if (!ok) return;
    populateUserSelect();
    document.getElementById('btn-recommend').disabled = false;
    document.getElementById('btn-train-ml').disabled = false;
    document.getElementById('status').innerText = 'Dataset loaded. Ready.';
    drawEmptyCharts();
  };

  document.getElementById('btn-recommend').onclick = ruleBasedRecommend;
  document.getElementById('btn-train-ml').onclick = trainMLModel;
  document.getElementById('btn-predict-ml').onclick = predictMLRecommend;
});

function populateUserSelect(){
  const sel = document.getElementById('user-select'); sel.innerHTML = '';
  const opt = document.createElement('option'); opt.value=''; opt.text='-- select user --'; sel.appendChild(opt);
  for (let i=0;i<users.length;i++){
    const u = users[i];
    const o = document.createElement('option'); o.value = u.Patient_ID; o.text = `User ${u.Patient_ID} — ${u.Recommended_Meal_Plan}`; sel.appendChild(o);
  }
}

// --- Rule-based recommendation (simple nearest by BMI+Goal)
function ruleBasedRecommend(){
  const uid = document.getElementById('user-select').value;
  if (!uid){ alert('Select user'); return; }
  const topk = parseInt(document.getElementById('topk').value||'5',10);
  const userIdx = userIdToIndex[uid];
  const u = users[userIdx];
  // find similar by same Goal (if available) and small BMI difference
  const candidates = users.map((other, idx) => {
    const scoreGoal = (other.Goal && u.Goal && other.Goal===u.Goal)?1:0;
    const bmiDiff = Math.abs((other.BMI||0)-(u.BMI||0));
    const score = scoreGoal*2 - bmiDiff/10; // simple heuristic
    return {idx, score, plan: other.Recommended_Meal_Plan};
  });
  candidates.sort((a,b)=> b.score - a.score);
  const top = [];
  const seen = new Set();
  for (const c of candidates){
    if (!seen.has(c.plan)){ top.push(c.plan); seen.add(c.plan); }
    if (top.length>=topk) break;
  }

  // compute average nutrition of recommended plans
  const recPlans = top;
  const recMacros = recPlans.map(p => mealPlans[p] ? [mealPlans[p].calories, mealPlans[p].protein, mealPlans[p].carbs, mealPlans[p].fats] : [0,0,0,0]);
  const avg = recMacros.reduce((acc,cur)=> cur.map((v,i)=> acc[i]+v), [0,0,0,0]).map(v=> v/recPlans.length);

  showRecommendation(u, recPlans, avg, 'Rule-based');
}

// --- ML Model: simple MLP classifier that maps user features -> distribution over meal plans
async function trainMLModel(){
  if (!userFeatureArray || userFeatureArray.length===0){ alert('Load dataset first'); return; }
  const epochs = parseInt(document.getElementById('cfg-epochs').value||'8',10);
  const batchSize = parseInt(document.getElementById('cfg-batch').value||'64',10);
  const hiddenDim = parseInt(document.getElementById('cfg-dim').value||'64',10);

  document.getElementById('train-log').textContent = 'Preparing training tensors...';
  // Build X, y
  const X = tf.tensor2d(userFeatureArray); // [N,6]
  const labels = users.map(u => mealPlanToIndex[u.Recommended_Meal_Plan]);
  const y = tf.tensor1d(labels, 'int32');
  const yOneHot = tf.oneHot(y, numMealPlans); // [N, numMealPlans]

  // Simple split train/test (80/20)
  const N = users.length;
  const idxs = Array.from({length:N}, (_,i)=>i);
  // shuffle indices
  for (let i=N-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [idxs[i],idxs[j]]=[idxs[j],idxs[i]]; }
  const split = Math.floor(N*0.8);
  const trainIdx = idxs.slice(0,split), testIdx = idxs.slice(split);
  const trainX = tf.gather(X, tf.tensor1d(trainIdx,'int32'));
  const trainY = tf.gather(yOneHot, tf.tensor1d(trainIdx,'int32'));
  const testX = tf.gather(X, tf.tensor1d(testIdx,'int32'));
  const testY = tf.gather(yOneHot, tf.tensor1d(testIdx,'int32'));

  // build model
  const model = tf.sequential();
  model.add(tf.layers.dense({inputShape:[userFeatureArray[0].length], units: hiddenDim, activation: 'relu'}));
  model.add(tf.layers.dropout({rate:0.2}));
  model.add(tf.layers.dense({units: Math.max(32, hiddenDim/2), activation:'relu'}));
  model.add(tf.layers.dense({units: numMealPlans, activation:'softmax'}));
  model.compile({optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy']});

  // callbacks to update UI
  historyLoss = [];
  const status = document.getElementById('status'), logEl = document.getElementById('train-log');
  status.innerText = 'Training ML model...';
  logEl.textContent = 'Training started...\n';

  await model.fit(trainX, trainY, {
    epochs, batchSize, shuffle:true,
    validationData: [testX, testY],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        const line = `Epoch ${epoch+1}/${epochs} — loss=${(logs.loss||0).toFixed(4)} val_loss=${(logs.val_loss||0).toFixed(4)} acc=${(logs.acc||logs.acc || logs.accumulator||0).toFixed? (logs.acc||0).toFixed(3) : (logs.acc||0)} val_acc=${(logs.val_acc||logs.valAccuracy||0).toFixed? (logs.val_acc||0).toFixed(3) : (logs.val_acc||0)}`;
        logEl.textContent += line + '\n';
        historyLoss.push(logs.loss || 0);
        drawLoss(historyLoss);
        await tf.nextFrame();
      }
    }
  });

  // evaluate on test set
  const evalRes = await model.evaluate(testX, testY, {batchSize: Math.min(256, testX.shape[0])});
  const testLoss = evalRes[0].dataSync()[0];
  const testAcc = evalRes[1].dataSync()[0];
  logEl.textContent += `\nTest Loss=${testLoss.toFixed(4)} Test Acc=${(testAcc*100).toFixed(2)}%\n`;

  // save model and enable predict
  mlModel = model;
  document.getElementById('btn-predict-ml').disabled = false;
  status.innerText = `Training done — test acc ${(testAcc*100).toFixed(2)}%`;
  // cleanup tensors
  X.dispose(); y.dispose(); yOneHot.dispose(); trainX.dispose(); trainY.dispose(); testX.dispose(); testY.dispose();
}

// --- Use ML model to predict top-K plans for selected user
async function predictMLRecommend(){
  if (!mlModel){ alert('Train ML model first'); return; }
  const uid = document.getElementById('user-select').value; if (!uid) { alert('Select user'); return; }
  const topk = parseInt(document.getElementById('topk').value||'5',10);
  const uidx = userIdToIndex[uid];
  const ufeat = tf.tensor2d([userFeatureArray[uidx]]);
  const pred = mlModel.predict(ufeat); // tensor [1, numMealPlans]
  const probs = await pred.data();
  // build sorted list
  const arr = [];
  for (let i=0;i<probs.length;i++) arr.push({plan: indexToMealPlan[i], score: probs[i]});
  arr.sort((a,b)=> b.score - a.score);
  const top = arr.slice(0, topk).map(x=> x.plan);
  // compute avg macros for top
  const recMacros = top.map(p => mealPlans[p] ? [mealPlans[p].calories, mealPlans[p].protein, mealPlans[p].carbs, mealPlans[p].fats] : [0,0,0,0]);
  const avg = recMacros.reduce((acc,cur)=> cur.map((v,i)=> acc[i]+v), [0,0,0,0]).map(v=> v/top.length);
  // find ground truth user
  const u = users[uidx];
  showRecommendation(u, top, avg, 'ML Model (softmax)');
  ufeat.dispose(); pred.dispose();
}

// --- helper to display recommendation + nutrition chart
function showRecommendation(userObj, recPlans, avgMacros, label){
  const wrap = document.getElementById('result');
  wrap.innerHTML = `
    <div><strong>User:</strong> ${userObj.Patient_ID} • Goal: ${userObj.Goal || 'N/A'} • BMI: ${userObj.BMI || 'N/A'}</div>
    <div style="margin-top:8px"><strong>${label} Top-${recPlans.length}:</strong> ${recPlans.join(', ')}</div>
  `;

  // draw nutrition chart: user vs recommended average
  const userVals = [userObj.Recommended_Calories||0, userObj.Recommended_Protein||0, userObj.Recommended_Carbs||0, userObj.Recommended_Fats||0];
  const recVals = avgMacros;

  const ctx = document.getElementById('nutritionChart').getContext('2d');
  if (nutritionChart) nutritionChart.destroy();
  nutritionChart = new Chart(ctx, {
    type:'bar',
    data: {
      labels: ['Calories','Protein','Carbs','Fats'],
      datasets: [
        { label: 'User Recommended (current)', data: userVals, backgroundColor: 'rgba(255,99,132,0.7)'},
        { label: `${label} Avg`, data: recVals, backgroundColor: 'rgba(54,162,235,0.7)'}
      ]
    },
    options: { responsive:true, plugins:{legend:{position:'top'}} }
  });

  // render rec table (comparison with baseline if available)
  renderRecTable(userObj, recPlans, label);
}

function renderRecTable(userObj, recPlans, label){
  const recWrap = document.getElementById('rec-wrap'); recWrap.innerHTML = '';
  const tbl = document.createElement('table');
  const header = document.createElement('tr');
  header.innerHTML = `<th>Ground-truth Plan</th><th>${label} Recs</th><th>Plan Avg Calories</th>`;
  tbl.appendChild(header);
  const truth = userObj.Recommended_Meal_Plan;
  for (let i=0;i<Math.max(recPlans.length,1);i++){
    const tr = document.createElement('tr');
    const left = (i===0)? `<strong>${escapeHtml(truth)}</strong>` : '';
    const mid = recPlans[i] ? escapeHtml(recPlans[i]) : '';
    const avg = recPlans[i] && mealPlans[recPlans[i]] ? Math.round(mealPlans[recPlans[i]].calories) : '';
    tr.innerHTML = `<td>${left}</td><td>${mid}</td><td>${avg}</td>`;
    tbl.appendChild(tr);
  }
  recWrap.appendChild(tbl);
}

// draw loss chart (history array)
function drawLoss(hist){
  const ctx = document.getElementById('lossChart').getContext('2d');
  if (lossChart) lossChart.destroy();
  lossChart = new Chart(ctx, {
    type:'line',
    data: {
      labels: hist.map((_,i)=>i+1),
      datasets: [{ label:'Train Loss', data: hist, borderColor:'#ff8a65', fill:false }]
    },
    options: { responsive:true, scales:{y:{beginAtZero:true}} }
  });
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
