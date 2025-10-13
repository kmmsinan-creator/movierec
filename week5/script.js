let model;
let lossChart;
let accChart;
let historyLoss = [];
let valLossHistory = [];
let historyAcc = [];
let valAccHistory = [];

// Utility to draw Loss and Accuracy charts
function drawCharts() {
  const lossCtx = document.getElementById("lossChart").getContext("2d");
  const accCtx = document.getElementById("accChart").getContext("2d");

  if (lossChart) lossChart.destroy();
  if (accChart) accChart.destroy();

  // ---- Loss Chart ----
  lossChart = new Chart(lossCtx, {
    type: "line",
    data: {
      labels: historyLoss.map((_, i) => i + 1),
      datasets: [
        {
          label: "Train Loss",
          data: historyLoss,
          borderColor: "#ff8a65",
          backgroundColor: "rgba(255,138,101,0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
        },
        {
          label: "Validation Loss",
          data: valLossHistory,
          borderColor: "#42a5f5",
          backgroundColor: "rgba(66,165,245,0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#fff", font: { weight: "bold" } },
        },
        title: {
          display: true,
          text: "Model Loss per Epoch",
          color: "#fff",
          font: { size: 16, weight: "bold" },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Epoch", color: "#ccc" },
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          title: { display: true, text: "Loss", color: "#ccc" },
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });

  // ---- Accuracy Chart ----
  accChart = new Chart(accCtx, {
    type: "line",
    data: {
      labels: historyAcc.map((_, i) => i + 1),
      datasets: [
        {
          label: "Train Accuracy",
          data: historyAcc,
          borderColor: "#81c784",
          backgroundColor: "rgba(129,199,132,0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
        },
        {
          label: "Validation Accuracy",
          data: valAccHistory,
          borderColor: "#fdd835",
          backgroundColor: "rgba(253,216,53,0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#fff", font: { weight: "bold" } },
        },
        title: {
          display: true,
          text: "Model Accuracy per Epoch",
          color: "#fff",
          font: { size: 16, weight: "bold" },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Epoch", color: "#ccc" },
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          title: { display: true, text: "Accuracy", color: "#ccc" },
          min: 0,
          max: 1,
          ticks: {
            color: "#ccc",
            callback: (v) => (v * 100).toFixed(0) + "%",
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

// ---- Training Function ----
async function trainModel() {
  const logEl = document.getElementById("log");
  logEl.innerHTML = "<b>Training started...</b><br>";

  // Mock dataset creation (replace with your CSV load or feature extraction)
  const numSamples = 200;
  const numFeatures = 8;
  const X = tf.randomNormal([numSamples, numFeatures]);
  const y = tf.oneHot(tf.randomUniform([numSamples], 0, 3, "int32"), 3);

  model = tf.sequential();
  model.add(tf.layers.dense({ units: 32, inputShape: [numFeatures], activation: "relu" }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: 3, activation: "softmax" }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  historyLoss = [];
  valLossHistory = [];
  historyAcc = [];
  valAccHistory = [];

  const epochs = 20;
  await model.fit(X, y, {
    epochs,
    validationSplit: 0.2,
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        historyLoss.push(logs.loss || 0);
        valLossHistory.push(logs.val_loss || 0);
        historyAcc.push(logs.acc || 0);
        valAccHistory.push(logs.val_acc || 0);
        drawCharts();

        logEl.innerHTML += `
          <div style="margin:2px 0;">
            <b>Epoch ${epoch + 1}/${epochs}</b> — 
            <span style="color:#9ef;">Loss:</span> ${logs.loss.toFixed(4)} |
            <span style="color:#ffb;">Val Loss:</span> ${logs.val_loss.toFixed(4)} |
            <span style="color:#9f9;">Acc:</span> ${(logs.acc * 100).toFixed(1)}% |
            <span style="color:#f99;">Val Acc:</span> ${(logs.val_acc * 100).toFixed(1)}%
          </div>`;
        logEl.scrollTop = logEl.scrollHeight;
      },
      onTrainEnd: () => {
        logEl.innerHTML += `<br><b style="color:#8bc34a;">Training complete ✅</b>`;
      },
    },
  });
}

// ---- Predict User Diet ----
async function predictDiet() {
  if (!model) return alert("Please train the model first!");
  const input = tf.randomNormal([1, 8]);
  const prediction = model.predict(input);
  const result = prediction.argMax(1).dataSync()[0];

  const diets = ["Low Carb Diet", "High Protein Diet", "Balanced Diet"];
  document.getElementById("result").innerHTML =
    `<b>Recommended Diet:</b> ${diets[result]}`;
}
