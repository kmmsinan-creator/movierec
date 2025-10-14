// Enable GPU acceleration for faster training
tf.setBackend('webgl');
tf.ready().then(() => console.log("✅ TensorFlow.js using WebGL GPU"));

// Global Variables
let model;
let features = [];
let labels = [];

// Load Dummy Data (you can replace with CSV later)
document.getElementById("loadDataBtn").addEventListener("click", async () => {
  document.getElementById("log").innerHTML = "Loading data...";
  
  // Generate fake diet data (for demo)
  const numSamples = 500;
  for (let i = 0; i < numSamples; i++) {
    const age = Math.random() * 40 + 18; // 18-58
    const bmi = Math.random() * 15 + 18; // 18-33
    const goal = Math.floor(Math.random() * 3); // 0,1,2
    const label = (goal === 0 && bmi > 26) ? 1 : 0; // simplistic label
    features.push([age, bmi, goal]);
    labels.push([label]);
  }

  document.getElementById("log").innerHTML = "✅ Data loaded successfully (" + features.length + " samples)";
});

// Build a simple MLP model
function createDietModel(inputDim) {
  const model = tf.sequential();
  
  model.add(tf.layers.dense({
    inputShape: [inputDim],
    units: 16,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));

  model.add(tf.layers.dense({
    units: 8,
    activation: 'relu'
  }));

  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));

  model.compile({
    optimizer: tf.train.adam(0.005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

// Train Model
document.getElementById("trainModelBtn").addEventListener("click", async () => {
  if (features.length === 0) return alert("Please load data first!");

  const xs = tf.tensor2d(features);
  const ys = tf.tensor2d(labels);

  model = createDietModel(xs.shape[1]);
  document.getElementById("log").innerHTML = "<b>Training started...</b><br>";

  const losses = [];
  const chartCanvas = document.getElementById("lossChart");
  const ctx = chartCanvas.getContext("2d");

  for (let epoch = 1; epoch <= 8; epoch++) {
    const h = await model.fit(xs, ys, {
      epochs: 1,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true
    });

    const loss = h.history.loss[0].toFixed(4);
    const acc = h.history.acc[0].toFixed(3);
    document.getElementById("log").innerHTML += 
      `<b>Epoch ${epoch}</b><br>Loss: ${loss}, Accuracy: ${acc}<br><br>`;
    losses.push(loss);
  }

  // Plot chart
  new Chart(ctx, {
    type: "line",
    data: {
      labels: losses.map((_, i) => i + 1),
      datasets: [{
        label: "Training Loss",
        data: losses,
        borderColor: "rgb(255,99,132)",
        borderWidth: 2,
        fill: false,
        tension: 0.3
      }]
    },
    options: { responsive: true }
  });

  document.getElementById("log").innerHTML += "<b style='color:#00e676;'>✅ Training completed!</b>";
});

// Predict Diet Plan
document.getElementById("predictBtn").addEventListener("click", async () => {
  if (!model) return alert("Train the model first!");

  const age = parseFloat(document.getElementById("age").value);
  const bmi = parseFloat(document.getElementById("bmi").value);
  const goal = document.getElementById("goal").value;

  if (!age || !bmi || !goal) {
    alert("Please fill all fields!");
    return;
  }

  const goalIndex = goal === "weight_loss" ? 0 : goal === "muscle_gain" ? 1 : 2;
  const input = tf.tensor2d([[age, bmi, goalIndex]]);
  const prediction = await model.predict(input).data();
  const confidence = (prediction[0] * 100).toFixed(1);

  const planType = prediction[0] > 0.5 ? "Low-carb, High-Protein" : "Balanced Nutrition";
  const reason =
    prediction[0] > 0.5
      ? "Based on your BMI and goal, a calorie-controlled, high-protein diet can help you achieve results faster."
      : "A balanced mix of nutrients supports maintenance and sustainable progress.";

  const exampleMeals =
    prediction[0] > 0.5
      ? `
      🥣 <b>Breakfast:</b> Greek yogurt with nuts and berries<br>
      🥗 <b>Lunch:</b> Grilled chicken salad with olive oil dressing<br>
      🍲 <b>Dinner:</b> Baked salmon with vegetables<br>
      `
      : `
      🍞 <b>Breakfast:</b> Whole grain toast with avocado<br>
      🍛 <b>Lunch:</b> Rice bowl with vegetables and tofu<br>
      🍝 <b>Dinner:</b> Pasta with lean meat and salad<br>
      `;

  const resultBox = document.getElementById("result");
  resultBox.style.border = prediction[0] > 0.5 ? "2px solid #f44336" : "2px solid #4caf50";
  resultBox.style.backgroundColor = prediction[0] > 0.5 ? "#ffeaea" : "#eaffea";

  resultBox.innerHTML = `
    <strong>Prediction Summary</strong><br>
    ➤ <b>Age:</b> ${age}<br>
    ➤ <b>BMI:</b> ${bmi}<br>
    ➤ <b>Goal:</b> ${goal.replace("_", " ")}<br><br>

    <b>Recommended Plan:</b> <span style="color:${prediction[0] > 0.5 ? '#d32f2f' : '#2e7d32'};">
      ${planType}
    </span><br>
    <b>Model Confidence:</b> ${confidence}%<br>

    <!-- Confidence Progress Bar -->
    <div id="confidenceBarContainer" style="
        width:100%; 
        height:20px; 
        background-color:#ddd; 
        border-radius:10px; 
        margin:10px 0;
        overflow:hidden;">
      <div id="confidenceBar" style="
        height:100%; 
        width:0%; 
        background-color:${prediction[0] > 0.5 ? '#f44336' : '#4caf50'}; 
        transition: width 1.2s ease;">
      </div>
    </div>

    <b>Reasoning:</b><br>${reason}<br><br>
    <b>Sample Daily Meals:</b><br>${exampleMeals}
  `;

  // Animate progress bar
  const bar = document.getElementById("confidenceBar");
  setTimeout(() => {
    bar.style.width = confidence + "%";
  }, 100);
});
