let globalData = [];

document.getElementById("loadData").addEventListener("click", () => {
  const fileInput = document.getElementById("csvFile");
  if (!fileInput.files.length) {
    alert("Please upload a CSV file first!");
    return;
  }

  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      globalData = result.data;
      displaySummary(globalData);
      drawCharts(globalData);
    },
  });
});

function displaySummary(data) {
  const columns = Object.keys(data[0]);
  const summaryDiv = document.getElementById("summary");

  summaryDiv.innerHTML = `
    <h3>✅ Dataset Loaded Successfully</h3>
    <p><strong>Rows:</strong> ${data.length}</p>
    <p><strong>Columns:</strong> ${columns.length}</p>
    <p><strong>Available Columns:</strong> ${columns.join(", ")}</p>
  `;
}

function drawCharts(data) {
  const numericCols = Object.keys(data[0]).filter((col) =>
    !isNaN(parseFloat(data[0][col]))
  );

  // Histogram for BMI
  if (numericCols.includes("BMI")) {
    const bmiValues = data.map((d) => parseFloat(d["BMI"]));
    Plotly.newPlot("distChart", [
      {
        x: bmiValues,
        type: "histogram",
        marker: { color: "#00C6FF" },
      },
    ], { title: "BMI Distribution", xaxis: { title: "BMI" } });
  }

  // Bar chart for Recommended Meal Plan counts
  if (data[0]["Recommended_Meal_Plan"]) {
    const planCounts = {};
    data.forEach((d) => {
      const plan = d["Recommended_Meal_Plan"];
      if (plan) planCounts[plan] = (planCounts[plan] || 0) + 1;
    });

    Plotly.newPlot("barChart", [
      {
        x: Object.keys(planCounts),
        y: Object.values(planCounts),
        type: "bar",
        marker: { color: "#FF6B6B" },
      },
    ], { title: "Recommended Meal Plan Distribution" });
  }

  // Heatmap (correlation)
  const numericData = numericCols.map((col) => data.map((d) => +d[col] || 0));
  const corr = correlationMatrix(numericData);
  Plotly.newPlot("heatmapChart", [
    {
      z: corr,
      x: numericCols,
      y: numericCols,
      type: "heatmap",
      colorscale: "RdBu",
    },
  ], { title: "Correlation Heatmap" });

  // Scatter plot: BMI vs Recommended Calories
  if (numericCols.includes("BMI") && numericCols.includes("Recommended_Calories")) {
    const bmi = data.map((d) => +d["BMI"]);
    const recCal = data.map((d) => +d["Recommended_Calories"]);
    Plotly.newPlot("scatterChart", [
      {
        x: bmi,
        y: recCal,
        mode: "markers",
        marker: { color: "#0072FF" },
      },
    ], { title: "BMI vs Recommended Calories" });
  }
}

// Utility: correlation matrix
function correlationMatrix(dataArrays) {
  const n = dataArrays.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = pearsonCorrelation(dataArrays[i], dataArrays[j]);
    }
  }
  return matrix;
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const num = x.map((_, i) => (x[i] - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0);
  const den = Math.sqrt(
    x.map((v) => Math.pow(v - meanX, 2)).reduce((a, b) => a + b, 0) *
    y.map((v) => Math.pow(v - meanY, 2)).reduce((a, b) => a + b, 0)
  );
  return den === 0 ? 0 : num / den;
}
