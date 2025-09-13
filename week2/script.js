// =============================
// UI and Recommendation Logic (updated)
// =============================

/**
 * Initialize app once window loads
 */
window.onload = async function () {
  await loadData(); // load from data.js
  populateMoviesDropdown();
  document.getElementById("result").innerText =
    "Data loaded. Please select a movie.";

  // Attach click handler to the button (robust: works for normal & module scripts)
  const btn = document.getElementById("recommend-btn");
  if (btn) {
    btn.addEventListener("click", getRecommendations);
  }
};

/**
 * Populate dropdown with movies sorted alphabetically
 */
function populateMoviesDropdown() {
  const select = document.getElementById("movie-select");

  // Clear existing options to avoid duplicates if called again
  select.innerHTML = "";

  // Sort alphabetically by title
  const sortedMovies = [...movies].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  // Add a helpful placeholder option
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.innerText = "-- select a movie --";
  placeholder.selected = true;
  placeholder.disabled = true;
  select.appendChild(placeholder);

  for (const movie of sortedMovies) {
    const option = document.createElement("option");
    option.value = String(movie.id); // store as string for safety
    option.innerText = movie.title;
    select.appendChild(option);
  }
}

/**
 * Main function to generate recommendations
 */
function getRecommendations() {
  const resultElement = document.getElementById("result");

  try {
    // show immediate feedback
    resultElement.innerText = "Finding recommendations...";

    // Step 1: Get user input
    const rawValue = document.getElementById("movie-select").value;
    const selectedId = Number(rawValue);

    if (Number.isNaN(selectedId) || rawValue === "") {
      resultElement.innerText = "Please choose a movie from the dropdown.";
      return;
    }

    // Step 2: Find liked movie
    const likedMovie = movies.find((m) => m.id === selectedId);
    if (!likedMovie) {
      resultElement.innerText = "Error: Movie not found. Please try again.";
      return;
    }

    // Step 3: Prepare for similarity
    const likedGenres = new Set(likedMovie.genres);
    const candidateMovies = movies.filter((m) => m.id !== likedMovie.id);

    // Step 4: Calculate scores
    const scoredMovies = candidateMovies.map((candidate) => {
      const candidateGenres = new Set(candidate.genres);
      const intersection = new Set(
        [...likedGenres].filter((g) => candidateGenres.has(g))
      );
      const union = new Set([...likedGenres, ...candidateGenres]);
      const score = union.size === 0 ? 0 : intersection.size / union.size;
      return { ...candidate, score };
    });

    // Step 5: Sort by score (descending)
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
  } catch (err) {
    console.error("getRecommendations error:", err);
    resultElement.innerText =
      "An error occurred while generating recommendations. See console for details.";
  }
}
