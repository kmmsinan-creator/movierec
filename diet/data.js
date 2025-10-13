let dietData = [];

async function loadDataset() {
  try {
    const response = await fetch('data/Personalized_Diet_Recommendations.csv');
    if (!response.ok) throw new Error('File not found or inaccessible!');
    const text = await response.text();

    const rows = text.trim().split('\n');
    const headers = rows[0].split(',');
    dietData = rows.slice(1).map(row => {
      const values = row.split(',');
      let obj = {};
      headers.forEach((h, i) => (obj[h.trim()] = values[i].trim()));
      return obj;
    });

    populateUsers();
    document.getElementById('result').textContent = '✅ Dataset loaded successfully!';
  } catch (err) {
    document.getElementById('result').textContent = '❌ Failed to load dataset: ' + err.message;
  }
}

function populateUsers() {
  const userSelect = document.getElementById('user-select');
  userSelect.innerHTML = '<option value="">-- Choose a user --</option>';

  const uniqueUsers = [...new Set(dietData.map(d => d.User_ID))];
  uniqueUsers.forEach(uid => {
    const option = document.createElement('option');
    option.value = uid;
    option.textContent = `User ${uid}`;
    userSelect.appendChild(option);
  });
}
