let nutritionChart = null;

document.getElementById('load-btn').addEventListener('click', loadDataset);
document.getElementById('recommend-btn').addEventListener('click', recommendDiet);

function recommendDiet() {
  const userId = document.getElementById('user-select').value;
  if (!userId) {
    document.getElementById('result').textContent = '⚠️ Please select a user first.';
    return;
  }

  const userData = dietData.find(d => d.User_ID === userId);
  if (!userData) {
    document.getElementById('result').textContent = '❌ User not found in dataset.';
    return;
  }

  // Basic rule-based recommendation: find similar BMI + Goal
  const similarUsers = dietData.filter(
    d => d.Goal === userData.Goal && Math.abs(d.BMI - userData.BMI) < 2
  );

  const avgCalories = avg(similarUsers.map(d => +d.Calories));
  const avgProtein = avg(similarUsers.map(d => +d.Protein));
  const avgCarbs = avg(similarUsers.map(d => +d.Carbs));
  const avgFat = avg(similarUsers.map(d => +d.Fat));

  const recommendedDiet = similarUsers[0]?.Recommended_Diet || 'Balanced Diet';

  document.getElementById('result').innerHTML = `
    <h3>Recommended Diet for User ${userId}</h3>
    <p><strong>Goal:</strong> ${userData.Goal}</p>
    <p><strong>Suggested Diet Type:</strong> ${recommendedDiet}</p>
    <p><strong>Average Nutrition (from similar users):</strong></p>
    <ul>
      <li>Calories: ${avgCalories.toFixed(1)} kcal</li>
      <li>Protein: ${avgProtein.toFixed(1)} g</li>
      <li>Carbs: ${avgCarbs.toFixed(1)} g</li>
      <li>Fat: ${avgFat.toFixed(1)} g</li>
    </ul>
  `;

  drawNutritionChart(userData, { avgCalories, avgProtein, avgCarbs, avgFat });
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function drawNutritionChart(user, rec) {
  const ctx = document.getElementById('nutritionChart').getContext('2d');
  const labels = ['Calories', 'Protein', 'Carbs', 'Fat'];

  const userData = [+user.Calories, +user.Protein, +user.Carbs, +user.Fat];
  const recData = [rec.avgCalories, rec.avgProtein, rec.avgCarbs, rec.avgFat];

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
