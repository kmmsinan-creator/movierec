// script.js
let nutritionChart = null;

document.getElementById('load-btn').addEventListener('click', loadDataset);
document.getElementById('recommend-btn').addEventListener('click', recommendDiet);

function recommendDiet() {
  const userId = document.getElementById('user-select').value;
  if (!userId) {
    document.getElementById('result').textContent = '⚠️ Please select a user first.';
    return;
  }

  // find user by User_ID or by fallback "row-#" used in populateUsers
  const userData = dietData.find(d => {
    const uid = (d.User_ID ?? d['User ID'] ?? d.id ?? '').toString().trim();
    if (uid) return uid === userId;
    // fallback: try matching the "row-N" token we created
    const idx = dietData.indexOf(d);
    return userId === `row-${idx+1}`;
  });

  if (!userData) {
    document.getElementById('result').textContent = '❌ User not found in dataset.';
    console.warn('User not found for id:', userId, 'dataset length:', dietData.length);
    return;
  }

  // Ensure BMI is numeric
  const userBMI = (typeof userData.BMI === 'number') ? userData.BMI : parseFloat(userData.BMI);
  const userGoal = userData.Goal ?? '';

  // Basic rule-based recommendation: find similar BMI + Goal
  const similarUsers = dietData.filter(d => {
    const dGoal = d.Goal ?? '';
    const dBMI = (typeof d.BMI === 'number') ? d.BMI : parseFloat(d.BMI);
    if (!dGoal || isNaN(dBMI) || isNaN(userBMI)) return false;
    return dGoal === userGoal && Math.abs(dBMI - userBMI) < 2;
  });

  // If no similar users found, relax filter to same Goal only
  let fallbackUsed = false;
  let sitter = similarUsers;
  if (sitter.length === 0) {
    sitter = dietData.filter(d => (d.Goal ?? '') === userGoal);
    fallbackUsed = sitter.length > 0;
  }

  // safe average function
  function safeAvg(values) {
    const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
    if (nums.length === 0) return 0;
    return nums.reduce((a,b)=>a+b, 0) / nums.length;
  }

  const avgCalories = safeAvg(sitter.map(d => d.Calories ?? d['Calories']));
  const avgProtein = safeAvg(sitter.map(d => d.Protein ?? d['Protein']));
  const avgCarbs    = safeAvg(sitter.map(d => d.Carbs ?? d['Carbs']));
  const avgFat      = safeAvg(sitter.map(d => d.Fat ?? d['Fat']));

  const recommendedDiet = (sitter[0] && (sitter[0].Recommended_Diet || sitter[0]['Recommended_Diet'])) || userData.Recommended_Diet || 'Balanced Diet';

  document.getElementById('result').innerHTML = `
    <h3>Recommended Diet for User ${userId}</h3>
    <p><strong>Goal:</strong> ${userGoal}</p>
    <p><strong>Suggested Diet Type:</strong> ${recommendedDiet}</p>
    <p><strong>Average Nutrition (from ${sitter.length} similar users${fallbackUsed ? ' — fallback by Goal only' : ''}):</strong></p>
    <ul>
      <li>Calories: ${avgCalories.toFixed(1)} kcal</li>
      <li>Protein: ${avgProtein.toFixed(1)} g</li>
      <li>Carbs: ${avgCarbs.toFixed(1)} g</li>
      <li>Fat: ${avgFat.toFixed(1)} g</li>
    </ul>
  `;

  // draw chart reads numeric or attempts to parse
  drawNutritionChart(userData, { avgCalories, avgProtein, avgCarbs, avgFat });
}
  
function drawNutritionChart(user, rec) {
  const ctx = document.getElementById('nutritionChart').getContext('2d');
  const labels = ['Calories', 'Protein', 'Carbs', 'Fat'];

  const userData = [
    Number(user.Calories ?? user['Calories']) || 0,
    Number(user.Protein ?? user['Protein']) || 0,
    Number(user.Carbs ?? user['Carbs']) || 0,
    Number(user.Fat ?? user['Fat']) || 0
  ];
  const recData = [rec.avgCalories || 0, rec.avgProtein || 0, rec.avgCarbs || 0, rec.avgFat || 0];

  if (nutritionChart) nutritionChart.destroy();

  nutritionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Current User',
          data: userData,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
        {
          label: 'Recommended Average',
          data: recData,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Nutrition Comparison' },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}
