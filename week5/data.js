// data.js
// Loads CSV and prepares user features and item labels for ML + rule-based
// Exposes globals: users (array), mealPlans (object), userFeatureArray, itemFeatureMatrix, mealPlanToIndex, indexToMealPlan

let rawRows = [];
let users = []; // objects per row
let mealPlans = {}; // aggregated plan features
let mealPlanToIndex = {}, indexToMealPlan = [];
let userIdToIndex = {}, indexToUserId = [];
let userFeatureArray = []; // numeric array per user
let itemFeatureMatrix = []; // [numPlans][4] calories/protein/carbs/fat
let numUsers = 0, numMealPlans = 0;

// Helper: safe split CSV line (naive - assumes no commas inside fields)
function splitCSVLine(line){
  return line.split(',').map(s => s.trim());
}

async function loadDatasetCSV() {
  const statusEl = document.getElementById('status');
  try {
    statusEl.innerText = 'Loading CSV...';
    const resp = await fetch('data/Personalized_Diet_Recommendations.csv');
    if (!resp.ok) throw new Error('CSV not found at data/Personalized_Diet_Recommendations.csv');
    const text = await resp.text();
    parseCSVText(text);
    buildMappings();
    statusEl.innerText = `Loaded ${users.length} records, ${numMealPlans} meal plans`;
    return true;
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.innerText = 'Load error: ' + err.message;
    return false;
  }
}

function parseCSVText(text){
  rawRows = [];
  users = [];
  mealPlans = {};
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV appears empty or malformed');
  const headers = splitCSVLine(lines[0]);
  for (let i=1;i<lines.length;i++){
    const parts = splitCSVLine(lines[i]);
    if (parts.length < headers.length) continue;
    const obj = {};
    for (let j=0;j<headers.length;j++){
      obj[headers[j]] = parts[j];
    }
    // normalize some numeric fields if they exist (common names)
    obj.Age = obj.Age ? +obj.Age : 0;
    obj.BMI = obj.BMI ? +obj.BMI : 0;
    obj.Blood_Sugar_Level = obj.Blood_Sugar_Level ? +obj.Blood_Sugar_Level : 0;
    obj.Cholesterol_Level = obj.Cholesterol_Level ? +obj.Cholesterol_Level : 0;
    // recommended macros
    obj.Recommended_Calories = obj.Recommended_Calories ? +obj.Recommended_Calories : 0;
    obj.Recommended_Protein = obj.Recommended_Protein ? +obj.Recommended_Protein : 0;
    obj.Recommended_Carbs = obj.Recommended_Carbs ? +obj.Recommended_Carbs : 0;
    obj.Recommended_Fats = obj.Recommended_Fats ? +obj.Recommended_Fats : 0;
    // IDs and plan name (flexible)
    obj.Patient_ID = obj.Patient_ID || obj.User_ID || obj.ID || String(i);
    obj.Recommended_Meal_Plan = obj.Recommended_Meal_Plan || obj.Recommended_Diet || obj.RecommendedPlan || 'Balanced Diet';
    users.push(obj);
  }

  // build mealPlans aggregation (average macros per plan)
  for (const u of users){
    const plan = u.Recommended_Meal_Plan;
    if (!mealPlans[plan]) mealPlans[plan] = {count:0, calories:0, protein:0, carbs:0, fats:0};
    const m = mealPlans[plan];
    m.count++; m.calories += u.Recommended_Calories; m.protein += u.Recommended_Protein;
    m.carbs += u.Recommended_Carbs; m.fats += u.Recommended_Fats;
  }
  for (const k of Object.keys(mealPlans)){
    const m = mealPlans[k];
    if (m.count>0){
      m.calories = m.calories / m.count;
      m.protein = m.protein / m.count;
      m.carbs = m.carbs / m.count;
      m.fats = m.fats / m.count;
    }
  }
}

function buildMappings(){
  // meal plan index
  mealPlanToIndex = {}; indexToMealPlan = [];
  let idx = 0;
  for (const k of Object.keys(mealPlans)){
    mealPlanToIndex[k] = idx; indexToMealPlan[idx]=k; idx++;
  }
  numMealPlans = indexToMealPlan.length;

  // user index
  userIdToIndex = {}; indexToUserId = [];
  users.forEach((u,i)=>{ userIdToIndex[u.Patient_ID]=i; indexToUserId[i]=u.Patient_ID; });
  numUsers = users.length;

  // build itemFeatureMatrix
  itemFeatureMatrix = [];
  for (let i=0;i<indexToMealPlan.length;i++){
    const plan = indexToMealPlan[i];
    const p = mealPlans[plan] || {calories:0,protein:0,carbs:0,fats:0};
    itemFeatureMatrix.push([p.calories, p.protein, p.carbs, p.fats]);
  }

  // build normalized userFeatureArray: [age/100, BMI/50, bloodSugar/300, chol/400, gender_M, hasChronic]
  userFeatureArray = users.map(u=>{
    const genderM = (u.Gender && u.Gender.toLowerCase().startsWith('m'))?1:0;
    const hasChronic = (u.Chronic_Disease && u.Chronic_Disease.toLowerCase()!=='none')?1:0;
    return [
      (u.Age||0)/100,
      (u.BMI||0)/50,
      (u.Blood_Sugar_Level||0)/300,
      (u.Cholesterol_Level||0)/400,
      genderM,
      hasChronic
    ];
  });
}
