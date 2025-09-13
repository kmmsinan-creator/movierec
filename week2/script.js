// script.js
// Handles UI interactions and recommendation logic

window.onload = async function () {
  try {
    await loadData(); // from data.js
    populateMoviesDropdown();
    document.getElementById("result").innerText =
      "Data loaded. Please select a movie.";
  } catch (error) {
    document.getElementById("result").innerText =
      "Error loading data. Please check files.";
  }

  document.getElementById("recommend-btn")
    .addEventListener("click", getRecommendations);
};

// Populate dropdown
function populateMoviesDropdown() {
  const select = document.getElementById("movie-select");
  select.innerHTML = "";

  const sortedMovies = [...movies].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  sortedMovies.forEach((movie) => {
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
    document.getElementById("result").innerText =
      "Please select a movie first.";
    return;
  }

  const likedMovie = movies.find((m) => m.id === selectedId);
  if (!likedMovie) {
    document.getElementById("result").innerText =
      "Movie not found in dataset.";
    return;
  }

  const likedGenres = new Set(likedMovie.genres);

  const candidateMovies = movies.filter((m) => m.id !== likedMovie.id);

  const scoredMovies = candidateMovies.map((m) => {
    const candidateGenres = new Set(m.genres);
    const intersection = new Set(
      [...likedGenres].filter((g) => candidateGenres.has(g))
    );
    const union = new Set([...likedGenres, ...candidateGenres]);
    const score = union.size === 0 ? 0 : intersection.size / union.size;
    return { ...m, score };
  });

  const topRecommendations = scoredMovies
    .sort((a, b) => b.score - a.score)
    .slice(0, 6); // show more like Netflix row

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  if (topRecommendations.length === 0) {
    resultDiv.innerHTML = "<p>No similar movies found.</p>";
    return;
  }

  topRecommendations.forEach((movie) => {
    const similarity = Math.round(movie.score * 100);
    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <h3>${movie.title}</h3>
      <p><strong>${similarity}% Match</strong></p>
      <div>${movie.genres
        .map((g) => `<span class="genre-tag">${g}</span>`)
        .join(" ")}</div>
    `;
    resultDiv.appendChild(card);
  });
}
