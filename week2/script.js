// Initialize application when window loads
window.onload = async function() {
    // Add scroll event listener for navbar
    window.addEventListener('scroll', handleNavbarScroll);
    
    // Load data first
    const success = await loadData();
    
    if (success) {
        // Then populate the dropdown and update status
        populateMoviesDropdown();
        document.getElementById('result').textContent = 
            'Data loaded. Please select a movie.';
        document.getElementById('result').className = 'status-message';
        
        // Add event listener to recommendation button
        document.getElementById('recommend-btn').addEventListener('click', getRecommendations);
    }
};

/**
 * Handle navbar scroll effect
 */
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

/**
 * Populate the movie dropdown with sorted movie titles
 */
function populateMoviesDropdown() {
    const selectElement = document.getElementById('movie-select');
    
    // Clear the default option
    selectElement.innerHTML = '';
    
    // Add a default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a movie...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectElement.appendChild(defaultOption);
    
    // Sort movies alphabetically by title
    const sortedMovies = [...movies].sort((a, b) => 
        a.title.localeCompare(b.title)
    );
    
    // Add each movie as an option
    sortedMovies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = movie.title;
        selectElement.appendChild(option);
    });
}

/**
 * Main function to calculate and display recommendations
 */
function getRecommendations() {
    // Step 1: Get user input
    const selectedMovieId = parseInt(document.getElementById('movie-select').value);
    
    // Validate selection
    if (isNaN(selectedMovieId)) {
        document.getElementById('result').textContent = 
            'Please select a movie first.';
        document.getElementById('result').className = 'error';
        return;
    }
    
    // Step 2: Find the liked movie
    const likedMovie = movies.find(movie => movie.id === selectedMovieId);
    if (!likedMovie) {
        document.getElementById('result').textContent = 
            'Error: Selected movie not found.';
        document.getElementById('result').className = 'error';
        return;
    }
    
    // Show loading state
    document.getElementById('result').textContent = 
        `Finding recommendations for "${likedMovie.title}"...`;
    document.getElementById('result').className = 'status-message';
    
    // Use setTimeout to allow the UI to update before heavy computation
    setTimeout(() => {
        // Step 3: Prepare for similarity calculation
        const likedGenres = new Set(likedMovie.genres);
        const candidateMovies = movies.filter(movie => movie.id !== likedMovie.id);
        
        // Step 4: Calculate Jaccard similarity scores
        const scoredMovies = candidateMovies.map(candidate => {
            const candidateGenres = new Set(candidate.genres);
            
            // Calculate intersection
            const intersection = new Set(
                [...likedGenres].filter(genre => candidateGenres.has(genre))
            );
            
            // Calculate union
            const union = new Set([...likedGenres, ...candidateGenres]);
            
            // Jaccard similarity = |Intersection| / |Union|
            const score = union.size > 0 ? intersection.size / union.size : 0;
            
            return {
                ...candidate,
                score: score
            };
        });
        
        // Step 5: Sort by score (descending)
        scoredMovies.sort((a, b) => b.score - a.score);
        
        // Step 6: Select top recommendations
        const topRecommendations = scoredMovies.slice(0, 5);
        
        // Step 7: Display results
        if (topRecommendations.length > 0) {
            let html = `<p>Because you liked <span class="highlight">${likedMovie.title}</span>, we recommend:</p>`;
            html += '<div class="recommended-movies">';
            
            topRecommendations.forEach(movie => {
                html += `
                    <div class="recommended-movie">
                        <div class="movie-poster" style="background-image: url('https://source.unsplash.com/random/200x300/?movie,${movie.genres[0]}')"></div>
                        <div class="movie-details">
                            <h4>${movie.title}</h4>
                            <p>Genres: ${movie.genres.join(', ')}</p>
                            <p class="similarity-score">Similarity: ${(movie.score * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            document.getElementById('result-box').innerHTML = html;
        } else {
            document.getElementById('result').textContent = 
                'No recommendations found.';
            document.getElementById('result').className = 'error';
        }
    }, 100);
}
