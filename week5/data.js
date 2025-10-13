// data.js
let dietData = [];

function detectSeparator(sampleLine) {
  if (sampleLine.indexOf('\t') !== -1) return '\t';
  return ','; // default
}

async function loadDataset() {
  try {
    const response = await fetch('data/Personalized_Diet_Recommendations.csv');
    if (!response.ok) throw new Error('File not found or inaccessible!');
    const text = await response.text();

    // Normalize line endings and trim
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) throw new Error('CSV is empty');

    const rows = normalized.split('\n');

    // Detect separator from header line
    const sep = detectSeparator(rows[0]);
    let headers = rows[0].split(sep).map(h => h.trim().replace(/^\uFEFF/, '')); // remove BOM if present

    // Lowercase header map for more tolerant matching
    const normalizedHeaders = headers.map(h => h.toLowerCase());

    dietData = rows.slice(1).map((row, idx) => {
      const values = row.split(sep);
      let obj = {};

      headers.forEach((h, i) => {
        const key = h.trim();
        const val = (values[i] ?? '').trim();
        obj[key] = val;
      });

      // Also create a normalized key map for common fields if user uses different header names
      // e.g. support "User ID", "user_id", "UserID" -> canonical "User_ID"
      // Find the index of a probable user id header:
      const userKeyIndex = normalizedHeaders.findIndex(h =>
        ['user_id', 'userid', 'user id', 'id'].includes(h)
      );
      if (userKeyIndex !== -1) {
        obj.User_ID = (values[userKeyIndex] ?? '').trim();
      }

      // Ensure numeric fields are numbers if present
      const numericFields = ['BMI', 'Calories', 'Protein', 'Carbs', 'Fat'];
      numericFields.forEach(f => {
        // try to find header case-insensitively
        const idx = normalizedHeaders.findIndex(h => h === f.toLowerCase());
        if (idx !== -1) {
          const raw = values[idx] ?? '';
          const num = parseFloat(raw.toString().replace(/[^\d\.\-]/g, ''));
          obj[f] = isNaN(num) ? null : num;
        }
      });

      // fallback: if BMI etc were present under slightly different headers (e.g. 'bmi')
      // try to coerce if not already set
      if (obj.BMI == null) {
        const idx = normalizedHeaders.findIndex(h => h === 'bmi');
        if (idx !== -1) {
          const raw = values[idx] ?? '';
          const num = parseFloat(raw.toString().replace(/[^\d\.\-]/g, ''));
          obj.BMI = isNaN(num) ? null : num;
        }
      }

      // keep Goal and Recommended_Diet fields with consistent keys (case-insensitive find)
      const goalIdx = normalizedHeaders.findIndex(h => ['goal'].includes(h));
      if (goalIdx !== -1 && !obj.Goal) obj.Goal = (values[goalIdx] ?? '').trim();

      const recIdx = normalizedHeaders.findIndex(h => ['recommended_diet', 'recommended diet', 'recommendeddiet', 'diet'].includes(h));
      if (recIdx !== -1 && !obj.Recommended_Diet) obj.Recommended_Diet = (values[recIdx] ?? '').trim();

      return obj;
    });

    // small debug: show first row parsed in console
    console.log('Loaded dietData sample:', dietData[0]);

    populateUsers();
    document.getElementById('result').textContent = '✅ Dataset loaded successfully!';
  } catch (err) {
    console.error(err);
    document.getElementById('result').textContent = '❌ Failed to load dataset: ' + err.message;
  }
}

function populateUsers() {
  const userSelect = document.getElementById('user-select');
  userSelect.innerHTML = '<option value="">-- Choose a user --</option>';

  // Gather user IDs robustly — prefer dietData[].User_ID, else fallback to index
  const uniqueUsers = [];
  dietData.forEach((d, i) => {
    const uid = (d.User_ID ?? d['User ID'] ?? d.id ?? '').toString().trim();
    const finalUid = uid || `row-${i+1}`; // fallback unique identifier
    if (!uniqueUsers.includes(finalUid)) uniqueUsers.push(finalUid);
  });

  uniqueUsers.forEach(uid => {
    const option = document.createElement('option');
    option.value = uid;
    option.textContent = `User ${uid}`;
    userSelect.appendChild(option);
  });

  // debug
  console.log('populateUsers added', uniqueUsers.length, 'users');
}
