window.onload = async function () {
  try {
    await loadData(); // from data.js
    populateMoviesDropdown();
    populateExtraSections();
    document.getElementById("result").innerText =
      "Data loaded. Please select a movie.";
  } catch (error) {
    document.getElementById("result").innerText =
      "Error loading data. Please check files.";
  }

  document.getElementById("recommend-btn")
    .addEventListener("click", getRecommendations);

  document.getElementById("search-input")
    .addEventListener("input", handleSearch);
};

// Dropdown
function populateMoviesDropdown() {
  const select = document.getElementById("movie-select");
  select.innerHTML = "";

  movies.sort((a, b) => a.title.localeCompare(b.title))
    .forEach((movie) => {
      const option = document.createElement("option");
      option.value = movie.id;
      option.textContent = movie.title;
      select.appendChild(option);
    });
}

// Recommendation logic
function getRecommendations() {
  const select = document.getElementById("movie-select");
  const selectedId = parseInt(select.value, 10);

  if (!selectedId) {
    document.getElementById("result").innerText = "Please select a movie first.";
    return;
  }

  const likedMovie = movies.find((m) => m.id === selectedId);
  const likedGenres = new Set(likedMovie.genres);
  const candidateMovies = movies.filter((m) => m.id !== likedMovie.id);

  const scoredMovies = candidateMovies.map((m) => {
    const candidateGenres = new Set(m.genres);
    const intersection = new Set([...likedGenres].filter((g) => candidateGenres.has(g)));
    const union = new Set([...likedGenres, ...candidateGenres]);
    const score = union.size === 0 ? 0 : intersection.size / union.size;
    return { ...m, score };
  });

  const topRecommendations = scoredMovies.sort((a, b) => b.score - a.score).slice(0, 6);

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

// Build Netflix-style movie card with poster
function makeMovieCard(movie, similarity = null) {
  const posterUrl = `https://picsum.photos/200/300?random=${movie.id}`;

  const card = document.createElement("div");
  card.className = "movie-card";
  card.innerHTML = `
    <img src="${posterUrl}" alt="${movie.title}" class="movie-poster">
    <div class="movie-info">
      <h3>${movie.title}</h3>
      ${similarity !== null ? `<p class="match">${similarity}% Match</p>` : ""}
      <div class="genres">
        ${movie.genres.map((g) => `<span class="genre-tag">${g}</span>`).join(" ")}
      </div>
    </div>
  `;
  return card;
}

// Extra Netflix-style rows
function populateExtraSections() {
  const trendingRow = document.getElementById("trending-row");
  const dramaRow = document.getElementById("drama-row");

  movies.slice(0, 10).forEach((m) => trendingRow.appendChild(makeMovieCard(m)));
  movies.filter((m) => m.genres.includes("Drama"))
        .slice(0, 10)
        .forEach((m) => dramaRow.appendChild(makeMovieCard(m)));
}

// Search feature
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const results = movies.filter((m) => m.title.toLowerCase().includes(query));

  const trendingRow = document.getElementById("trending-row");
  trendingRow.innerHTML = "";

  if (query === "") {
    movies.slice(0, 10).forEach((m) => trendingRow.appendChild(makeMovieCard(m)));
  } else {
    results.forEach((m) => trendingRow.appendChild(makeMovieCard(m)));
  }
}
