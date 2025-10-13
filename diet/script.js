let nutritionChart = null;

document.getElementById('load-btn').addEventListener('click', loadDataset);
document.getElementById('recommend-btn').addEventListener('click', recommendDiet);

function recommendDiet() {
  const userId = document.getElementById('user-select').value;
  if (!userId) {
    document.getElementById('result').textContent = '⚠️ Please select a patient first.';
    return;
  }

  const userData = dietData.find(d => d.Patient_ID === userId);
  if (!userData) {
    document.getElementById('result').textContent = '❌ Patient not found in dataset.';
    return;
  }

  // Find similar users (within 2 BMI points)
  const userBMI = parseFloat(userData.BMI);
  const similarUsers = dietData.filter(d => Math.abs(parseFloat(d.BMI) - userBMI) < 2);

  const avgCalories = avg(similarUsers.map(d => +d.Recommended_Calories));
  const avgProtein = avg(similarUsers.map(d => +d.Recommended_Protein));
  const avgCarbs = avg(similarUsers.map(d => +d.Recommended_Carbs));
  const avgFat = avg(similarUsers.map(d => +d.Recommended_Fats));

  const recommendedDiet = userData.Recommended_Meal_Plan || 'Balanced Diet';

  document.getElementById('result').innerHTML = `
    <h3>Recommended Diet for ${userId}</h3>
    <p><strong>BMI:</strong> ${userData.BMI}</p>
    <p><strong>Suggested Meal Plan:</strong> ${recommendedDiet}</p>
    <p><strong>Average Nutritional Targets (similar patients):</strong></p>
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
  const nums = arr.filter(x => !isNaN(x));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function drawNutritionChart(user, rec) {
  const ctx = document.getElementById('nutritionChart').getContext('2d');
  const labels = ['Calories', 'Protein', 'Carbs', 'Fat'];

  const userData = [
    +user.Caloric_Intake,
    +user.Protein_Intake,
    +user.Carbohydrate_Intake,
    +user.Fat_Intake
  ];
  const recData = [rec.avgCalories, rec.avgProtein, rec.avgCarbs, rec.avgFat];

  if (nutritionChart) nutritionChart.destroy();

  nutritionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Current Patient',
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
