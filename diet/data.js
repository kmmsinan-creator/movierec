let dietData = [];

async function loadDataset() {
  try {
    const response = await fetch('data/Personalized_Diet_Recommendations.csv');
    if (!response.ok) throw new Error('File not found or inaccessible!');
    const text = await response.text();

    const rows = text.trim().split('\n');
    const headers = rows[0].split('\t').length > 1
      ? rows[0].split('\t')
      : rows[0].split(',');

    dietData = rows.slice(1).map(row => {
      const values = row.split('\t').length > 1
        ? row.split('\t')
        : row.split(',');

      let obj = {};
      headers.forEach((h, i) => (obj[h.trim()] = (values[i] || '').trim()));
      return obj;
    });

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

  // Use the correct column name: Patient_ID
  const uniqueUsers = [...new Set(dietData.map(d => d.Patient_ID))];

  uniqueUsers.forEach(uid => {
    if (uid) {
      const option = document.createElement('option');
      option.value = uid;
      option.textContent = `Patient ${uid}`;
      userSelect.appendChild(option);
    }
  });

  console.log('✅ Users loaded:', uniqueUsers.length);
}
