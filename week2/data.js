// =============================
// Data Handling Module
// =============================

// Global arrays for movies and ratings
let movies = [];
let ratings = [];

/**
 * Main async function to load and parse movie & rating data
 */
async function loadData() {
  try {
    // Load u.item (movies data)
    const itemResponse = await fetch("u.item");
    const itemText = await itemResponse.text();
    parseItemData(itemText);

    // Load u.data (ratings data)
    const dataResponse = await fetch("u.data");
    const dataText = await dataResponse.text();
    parseRatingData(dataText);
  } catch (error) {
    // Display error in result box if something fails
    document.getElementById("result").innerText =
      "Error loading data: " + error.message;
  }
}

/**
 * Parse u.item file text and populate movies array
 * @param {string} text - raw file content
 */
function parseItemData(text) {
  const genreNames = [
    "Unknown", "Action", "Adventure", "Animation", "Children's",
    "Comedy", "Crime", "Documentary", "Drama", "Fantasy",
    "Film-Noir", "Horror", "Musical", "Mystery", "Romance",
    "Sci-Fi", "Thriller", "War", "Western"
  ];

  const lines = text.split("\n");

  for (const line of lines) {
    if (line.trim() === "") continue;

    const parts = line.split("|");
    const id = parseInt(parts[0]);
    const title = parts[1];

    // Last 19 entries are genres (0 or 1)
    const genreFlags = parts.slice(-19);
    const genres = genreNames.filter((_, idx) => genreFlags[idx] === "1");

    movies.push({ id, title, genres });
  }
}

/**
 * Parse u.data file text and populate ratings array
 * @param {string} text - raw file content
 */
function parseRatingData(text) {
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.trim() === "") continue;

    const parts = line.split("\t");
    const userId = parseInt(parts[0]);
    const itemId = parseInt(parts[1]);
    const rating = parseInt(parts[2]);
    const timestamp = parseInt(parts[3]);

    ratings.push({ userId, itemId, rating, timestamp });
  }
}
