// Initialize application when window loads
window.onload = async function() {
    try {
        // Display loading message
        const resultElement = document.getElementById('result');
        resultElement.textContent = 'Loading movie data...';
        resultElement.className = 'loading';
        
        // Load data
        await loadData();
        
        // Populate dropdown and update status
        populateMoviesDropdown();
        resultElement.textContent = 'Data loaded. Please select a movie.';
        resultElement.className = 'success';
    } catch (error) {
        console.error('Initialization error:', error);
        // Error message is already set in loadData()
    }
};

// Populate the movie dropdown with sorted titles
function populateMoviesDropdown() {
    const selectElement = document.getElementById('movie-select');
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a movie...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectElement.appendChild(defaultOption);
    
    // Sort movies alphabetically by title
    const sortedMovies = [...movies].sort((a, b) => {
        return a.title.localeCompare(b.title);
    });
    
    // Add movie options
    sortedMovies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = movie.title;
        selectElement.appendChild(option);
    });
}

// Main recommendation function
function getRecommendations() {
    const resultElement = document.getElementById('result');
    
    try {
        // Step 1: Get user input
        const selectedMovieId = parseInt(document.getElementById('movie-select').value);
        
        if (isNaN(selectedMovieId)) {
            resultElement.textContent = 'Please select a movie first.';
            resultElement.className = 'error';
            return;
        }
        
        // Show loading state
        resultElement.textContent = 'Finding recommendations...';
        resultElement.className = 'loading';
        
        // Step 2: Find the liked movie
        const likedMovie = movies.find(movie => movie.id === selectedMovieId);
        
        if (!likedMovie) {
            resultElement.textContent = 'Selected movie not found in database.';
            resultElement.className = 'error';
            return;
        }
        
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
            
            // Calculate Jaccard index
            const score = union.size > 0 ? intersection.size / union.size : 0;
            
            return {
                id: candidate.id,
                title: candidate.title,
                genres: candidate.genres,
                score: score
            };
        });
        
        // Step 5: Sort by score in descending order
        scoredMovies.sort((a, b) => b.score - a.score);
        
        // Step 6: Select top recommendations
        const topRecommendations = scoredMovies.slice(0, 2);
        
        // Step 7: Display results
        if (topRecommendations.length > 0) {
            const recommendationTitles = topRecommendations.map(movie => movie.title);
            resultElement.innerHTML = `Because you liked <strong>"${likedMovie.title}"</strong>, we recommend:<br><br>`;
            
            topRecommendations.forEach((movie, index) => {
                resultElement.innerHTML += `${index + 1}. ${movie.title} (${(movie.score * 100).toFixed(0)}% match)<br>`;
            });
            
            resultElement.className = 'success';
        } else {
            resultElement.textContent = 'No recommendations found for this movie.';
            resultElement.className = 'error';
        }
    } catch (error) {
        console.error('Error in getRecommendations:', error);
        resultElement.textContent = 'An error occurred while generating recommendations.';
        resultElement.className = 'error';
    }
}
