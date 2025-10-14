let globalData = [];

document.getElementById("loadData").addEventListener("click", () => {
  const file = document.getElementById("csvFile").files[0];
  if (!file) {
    alert("Please upload a CSV file!");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      globalData = result.data;
      setupDashboard(globalData);
    },
  });
});

function setupDashboard(data) {
  const cols = Object.keys(data[0]);
  const numCols = cols.filter((c) => !isNaN(parseFloat(data[0][c])));
  const catCols = cols.filter((c) => isNaN(parseFloat(data[0][c])));

  // Summary cards
  document.getElementById("summary").innerHTML = `
    <div class="summary-card"><h2>${data.length}</h2><p>Rows</p></div>
    <div class="summary-card"><h2>${cols.length}</h2><p>Columns</p></div>
    <div class="summary-card"><h2>${numCols.length}</h2><p>Numeric Columns</p></div>
    <div class="summary-card"><h2>${catCols.length}</h2><p>Categorical Columns</p></div>
  `;

  const numSelect = document.getElementById("numericSelect");
  const catSelect = document.getElementById("categorySelect");

  numSelect.innerHTML = numCols.map((c) => `<option value="${c}">${c}</option>`).join("");
  catSelect.innerHTML = catCols.map((c) => `<option value="${c}">${c}</option>`).join("");

  document.getElementById("updatePlots").onclick = () => {
    drawEDA(data, numSelect.value, catSelect.value);
  };

  // Draw initial graphs
  drawEDA(data, numCols[0], catCols[0]);
}

function drawEDA(data, numericCol, categoryCol) {
  const numValues = data.map((d) => parseFloat(d[numericCol]) || 0);

  // Histogram
  Plotly.newPlot("distChart", [
    { x: numValues, type: "histogram", marker: { color: "#0072ff" } },
  ], {
    title: `${numericCol} Distribution`,
    xaxis: { title: numericCol },
    yaxis: { title: "Count" },
  });

  // Bar chart (category-wise average)
  if (categoryCol) {
    const grouped = {};
    data.forEach((d) => {
      const cat = d[categoryCol];
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(parseFloat(d[numericCol]) || 0);
    });

    const cats = Object.keys(grouped);
    const means = cats.map((c) => avg(grouped[c]));
    Plotly.newPlot("barChart", [
      { x: cats, y: means, type: "bar", marker: { color: "#00c6ff" } },
    ], {
      title: `Average ${numericCol} by ${categoryCol}`,
      xaxis: { title: categoryCol },
      yaxis: { title: `Average ${numericCol}` },
    });
  }

  // Heatmap
  const numCols = Object.keys(data[0]).filter((c) => !isNaN(parseFloat(data[0][c])));
  const matrix = numCols.map((c) => data.map((d) => parseFloat(d[c]) || 0));
  const corr = correlationMatrix(matrix);
  Plotly.newPlot("heatmapChart", [{
    z: corr,
    x: numCols,
    y: numCols,
    type: "heatmap",
    colorscale: "RdBu",
  }], {
    title: "Correlation Heatmap",
  });

  // Scatter plot (BMI vs Recommended Calories if available)
  if ("BMI" in data[0] && "Recommended_Calories" in data[0]) {
    const bmi = data.map((d) => parseFloat(d["BMI"]) || 0);
    const recCal = data.map((d) => parseFloat(d["Recommended_Calories"]) || 0);
    Plotly.newPlot("scatterChart", [{
      x: bmi,
      y: recCal,
      mode: "markers",
      marker: { color: "#ff6b6b" },
    }], {
      title: "BMI vs Recommended Calories",
      xaxis: { title: "BMI" },
      yaxis: { title: "Recommended Calories" },
    });
  }
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function correlationMatrix(dataArrays) {
  const n = dataArrays.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = pearson(dataArrays[i], dataArrays[j]);
    }
  }
  return matrix;
}

function pearson(x, y) {
  const n = x.length;
  const meanX = avg(x);
  const meanY = avg(y);
  const num = x.map((_, i) => (x[i] - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0);
  const den = Math.sqrt(
    x.map((v) => Math.pow(v - meanX, 2)).reduce((a, b) => a + b, 0) *
    y.map((v) => Math.pow(v - meanY, 2)).reduce((a, b) => a + b, 0)
  );
  return den ? num / den : 0;
}
