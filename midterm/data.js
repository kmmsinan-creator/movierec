// data.js
// Loads data/Personalized_Diet_Recommendations.csv and prepares structures
let rawData = [];
let users = []; // user objects
let mealPlans = {}; // mealPlanName -> aggregated nutrition features
let userIdToIndex = {}, indexToUserId = [];
let mealPlanToIndex = {}, indexToMealPlan = [];
let numUsers=0, numMealPlans=0;
let userFeatureDim = 0, itemFeatureDim = 4; // item features: calories, protein, carbs, fats

async function loadData() {
  try {
    const resp = await fetch('data/Personalized_Diet_Recommendations.csv');
    if (!resp.ok) throw new Error('Failed to fetch CSV');
    const text = await resp.text();
    parseCSV(text);
    buildMappings();
    return true;
  } catch (err) {
    console.error(err);
    const s=document.getElementById('status'); if(s) s.innerText='Load error: '+err.message;
    return false;
  }
}

function parseCSV(text) {
  rawData = [];
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',');
  const cols = header.map(h=>h.trim());
  for (let i=1;i<lines.length;i++){
    const line = lines[i];
    if (!line.trim()) continue;
    // naive CSV parse (assumes no commas inside fields)
    const parts = line.split(',');
    if (parts.length < cols.length) continue;
    const obj = {};
    for (let j=0;j<cols.length;j++) obj[cols[j]] = parts[j];
    rawData.push(obj);
  }

  // Normalize types & build per-user objects
  users = rawData.map(r=>{
    return {
      id: r['Patient_ID'],
      Age: +r['Age']||0,
      Gender: r['Gender']||'Unknown',
      BMI: +r['BMI']||0,
      Chronic_Disease: r['Chronic_Disease']||'None',
      Blood_Sugar_Level: +r['Blood_Sugar_Level']||0,
      Cholesterol_Level: +r['Cholesterol_Level']||0,
      Food_Aversions: r['Food_Aversions']||'None',
      Preferred_Cuisine: r['Preferred_Cuisine']||'Any',
      Recommended_Calories: +r['Recommended_Calories']||0,
      Recommended_Protein: +r['Recommended_Protein']||0,
      Recommended_Carbs: +r['Recommended_Carbs']||0,
      Recommended_Fats: +r['Recommended_Fats']||0,
      Recommended_Meal_Plan: r['Recommended_Meal_Plan']||'Balanced Diet'
    };
  });

  // Build meal plan item features (average macros for each plan)
  mealPlans = {};
  for (const u of users){
    const plan = u.Recommended_Meal_Plan;
    if (!mealPlans[plan]) mealPlans[plan] = {count:0, calories:0, protein:0, carbs:0, fats:0};
    const mp = mealPlans[plan];
    mp.count++;
    mp.calories += u.Recommended_Calories;
    mp.protein += u.Recommended_Protein;
    mp.carbs += u.Recommended_Carbs;
    mp.fats += u.Recommended_Fats;
  }
  // average
  for (const k of Object.keys(mealPlans)){
    const m = mealPlans[k];
    m.calories = m.calories/m.count;
    m.protein = m.protein/m.count;
    m.carbs = m.carbs/m.count;
    m.fats = m.fats/m.count;
  }
}

function buildMappings(){
  // users mapping
  userIdToIndex = {}; indexToUserId = [];
  users.forEach((u,i)=>{ userIdToIndex[u.id]=i; indexToUserId.push(u.id); });
  numUsers = users.length;
  // meal plans mapping
  mealPlanToIndex = {}; indexToMealPlan = [];
  let idx=0;
  for (const plan of Object.keys(mealPlans)){
    mealPlanToIndex[plan]=idx; indexToMealPlan.push(plan); idx++;
  }
  numMealPlans = indexToMealPlan.length;
  // itemFeatureDim already set to 4 (calories,protein,carbs,fats)
  userFeatureDim = 6; // we'll construct: [Age_norm, BMI_norm, blood sugar_norm, cholesterol_norm, gender_bin, chronic_bin] (simple)
}

// utility to get item features array by index
function getItemFeaturesMatrix(){
  const mat = [];
  for (let i=0;i<indexToMealPlan.length;i++){
    const plan = indexToMealPlan[i];
    const m = mealPlans[plan];
    mat.push([m.calories, m.protein, m.carbs, m.fats]);
  }
  return mat;
}

// utility to build user numeric features (simple scaling)
function buildUserFeatureArray() {
  // simple normalization constants from dataset; for demo we scale by rough maxes
  const arr = users.map(u=>{
    return [
      u.Age/100.0,
      u.BMI/50.0,
      u.Blood_Sugar_Level/300.0,
      u.Cholesterol_Level/400.0,
      (u.Gender==='Male')?1:0,
      (u.Chronic_Disease && u.Chronic_Disease!=='None')?1:0
    ];
  });
  return arr;
}
