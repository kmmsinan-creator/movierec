// script.js
// Handles UI interactions and recommendation logic

window.onload = async function () {
  try {
    await loadData(); // from data.js
    populateMoviesDropdown();
    populateExtraSections();
    // initial helper text in the result area (will be replaced later)
    document.getElementById("result").innerText = "Data loaded. Please select a movie.";
  } catch (error) {
    document.getElementById("result").innerText = "Error loading data. Please check files.";
    console.error(error);
  }

  // Attach handlers
  document.getElementById("recommend-btn").addEventListener("click", getRecommendations);
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.addEventListener("input", handleSearch);
};

/**
 * Populate the movie dropdown.
 * Ensures there is a placeholder option as the first item.
 */
function populateMoviesDropdown() {
  const select = document.getElementById("movie-select");

  // Clear everything and add a placeholder option first
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = "-- Select a movie --";
  select.appendChild(placeholder);

  // Sort alphabetically and add options
  const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

  for (const movie of sortedMovies) {
    const option = document.createElement("option");
    option.value = movie.id;           // store id (number) as value
    option.textContent = movie.title;
    select.appendChild(option);
  }
}

/**
 * Main recommendation logic (content-based using Cosine Similarity)
 */
function getRecommendations() {
  const select = document.getElementById("movie-select");
  const raw = select.value;

  // If placeholder or empty is selected
  if (!raw) {
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "<p style='padding:12px;color:#f1c0c0;'>Please select a movie first.</p>";
    return;
  }

  const selectedId = parseInt(raw, 10);

  if (Number.isNaN(selectedId)) {
    document.getElementById("result").innerText = "Invalid movie selection.";
    return;
  }

  const likedMovie = movies.find((m) => m.id === selectedId);
  if (!likedMovie) {
    document.getElementById("result").innerText = "Movie not found in dataset.";
    return;
  }

  const likedGenres = new Set(likedMovie.genres);
  const candidateMovies = movies.filter((m) => m.id !== likedMovie.id);

  const scoredMovies = candidateMovies.map((m) => {
    const candidateGenres = new Set(m.genres);

    // Cosine Similarity calculation
    const intersectionSize = [...likedGenres].filter((g) => candidateGenres.has(g)).length;
    const normLiked = Math.sqrt(likedGenres.size);
    const normCandidate = Math.sqrt(candidateGenres.size);

    const score = (normLiked === 0 || normCandidate === 0)
      ? 0
      : intersectionSize / (normLiked * normCandidate);

    return { ...m, score };
  });

  // take top 6 for a nice row
  const topRecommendations = scoredMovies.sort((a, b) => b.score - a.score).slice(0, 6);

  // Render as poster-style cards
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  if (topRecommendations.length === 0) {
    resultDiv.innerHTML = "<p>No similar movies found.</p>";
    return;
  }

  topRecommendations.forEach((movie) => {
    const similarity = Math.round(movie.score * 100);
    resultDiv.appendChild(makeMovieCard(movie, similarity));
  });
}

/**
 * Create a Netflix-style poster card for a movie.
 * Uses a placeholder poster (picsum) with a deterministic query to keep poster stable.
 */
function makeMovieCard(movie, similarity = null) {
  // deterministic/randomized-ish poster using movie id so each movie gets a unique image
  const posterUrl = `https://picsum.photos/300/420?random=${encodeURIComponent(movie.id)}`;

  const card = document.createElement("div");
  card.className = "movie-card";
  card.innerHTML = `
    <img src="${posterUrl}" alt="${escapeHtml(movie.title)}" class="movie-poster">
    <div class="movie-info">
      <h3>${escapeHtml(movie.title)}</h3>
      ${similarity !== null ? `<p class="match">${similarity}% Match</p>` : ""}
      <div class="genres">
        ${movie.genres.map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`).join(" ")}
      </div>
    </div>
  `;
  return card;
}

/**
 * Populate extra Netflix-like rows (Trending, Drama)
 */
function populateExtraSections() {
  const trendingRow = document.getElementById("trending-row");
  const dramaRow = document.getElementById("drama-row");

  if (trendingRow) {
    trendingRow.innerHTML = "";
    movies.slice(0, 10).forEach((m) => trendingRow.appendChild(makeMovieCard(m)));
  }

  if (dramaRow) {
    dramaRow.innerHTML = "";
    movies.filter((m) => m.genres.includes("Drama")).slice(0, 10)
      .forEach((m) => dramaRow.appendChild(makeMovieCard(m)));
  }
}

/**
 * Basic search handler — updates the Trending row to show search results
 */
function handleSearch(e) {
  const query = String(e.target.value || "").trim().toLowerCase();
  const trendingRow = document.getElementById("trending-row");
  if (!trendingRow) return;

  trendingRow.innerHTML = "";

  if (query === "") {
    movies.slice(0, 10).forEach((m) => trendingRow.appendChild(makeMovieCard(m)));
    return;
  }

  const results = movies.filter((m) => m.title.toLowerCase().includes(query));
  results.slice(0, 20).forEach((m) => trendingRow.appendChild(makeMovieCard(m)));
}

/* Small utility to avoid HTML injection in titles/genres */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
