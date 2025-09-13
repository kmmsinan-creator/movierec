// =============================
// UI and Recommendation Logic
// =============================

/**
 * Initialize app once window loads
 */
window.onload = async function () {
  await loadData(); // load from data.js
  populateMoviesDropdown();
  document.getElementById("result").innerText =
    "Data loaded. Please select a movie.";
};

/**
 * Populate dropdown with movies sorted alphabetically
 */
function populateMoviesDropdown() {
  const select = document.getElementById("movie-select");

  // Sort alphabetically
  const sortedMovies = [...movies].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  for (const movie of sortedMovies) {
    const option = document.createElement("option");
    option.value = movie.id;
    option.innerText = movie.title;
    select.appendChild(option);
  }
}

/**
 * Main function to generate recommendations
 */
function getRecommendations() {
  const resultElement = document.getElementById("result");

  // Step 1: Get user input
  const selectedId = parseInt(
    document.getElementById("movie-select").value
  );

  // Step 2: Find liked movie
  const likedMovie = movies.find((m) => m.id === selectedId);
  if (!likedMovie) {
    resultElement.innerText = "Error: Movie not found.";
    return;
  }

  // Step 3: Prepare for similarity
  const likedGenres = new Set(likedMovie.genres);
  const candidateMovies = movies.filter((m) => m.id !== likedMovie.id);

  // Step 4: Calculate scores
  const scoredMovies = candidateMovies.map((candidate) => {
    const candidateGenres = new Set(candidate.genres);

    // Jaccard similarity
    const intersection = new Set(
      [...likedGenres].filter((g) => candidateGenres.has(g))
    );
    const union = new Set([...likedGenres, ...candidateGenres]);
    const score =
      union.size === 0 ? 0 : intersection.size / union.size;

    return { ...candidate, score };
  });

  // Step 5: Sort by score
  scoredMovies.sort((a, b) => b.score - a.score);

  // Step 6: Select top 2
  const topRecommendations = scoredMovies.slice(0, 2);

  // Step 7: Display result
  if (topRecommendations.length > 0) {
    const recTitles = topRecommendations.map((m) => m.title).join(", ");
    resultElement.innerText = `Because you liked "${likedMovie.title}", we recommend: ${recTitles}`;
  } else {
    resultElement.innerText = `Sorry, no similar movies found for "${likedMovie.title}".`;
  }
}
