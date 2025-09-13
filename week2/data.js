// Global variables for movie and rating data
let movies = [];
let ratings = [];

// Genre names as defined in the u.item file
const genres = [
    "Action", "Adventure", "Animation", "Children's", "Comedy", "Crime", 
    "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "Musical", 
    "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"
];

// Primary function to load data from files
async function loadData() {
    try {
        // Load and parse movie data
        const moviesResponse = await fetch('u.item');
        if (!moviesResponse.ok) {
            throw new Error(`Failed to load movie data: ${moviesResponse.status}`);
        }
        const moviesText = await moviesResponse.text();
        parseItemData(moviesText);
        
        // Load and parse rating data
        const ratingsResponse = await fetch('u.data');
        if (!ratingsResponse.ok) {
            throw new Error(`Failed to load rating data: ${ratingsResponse.status}`);
        }
        const ratingsText = await ratingsResponse.text();
        parseRatingData(ratingsText);
        
        return { movies, ratings };
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('result').textContent = 
            `Error: ${error.message}. Please make sure u.item and u.data files are available.`;
        document.getElementById('result').className = 'error';
        throw error;
    }
}

// Parse movie data from text
function parseItemData(text) {
    const lines = text.split('\n');
    movies = []; // Reset movies array
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const fields = line.split('|');
        if (fields.length < 5) continue;
        
        const id = parseInt(fields[0]);
        const title = fields[1];
        const genreFields = fields.slice(5, 24); // Get the 19 genre indicator fields
        
        // Convert genre indicators to an array of genre names
        const movieGenres = genreFields.map((indicator, index) => {
            return indicator === '1' ? genres[index] : null;
        }).filter(genre => genre !== null);
        
        movies.push({ id, title, genres: movieGenres });
    }
}

// Parse rating data from text
function parseRatingData(text) {
    const lines = text.split('\n');
    ratings = []; // Reset ratings array
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const fields = line.split('\t');
        if (fields.length < 4) continue;
        
        const userId = parseInt(fields[0]);
        const itemId = parseInt(fields[1]);
        const rating = parseFloat(fields[2]);
        const timestamp = parseInt(fields[3]);
        
        ratings.push({ userId, itemId, rating, timestamp });
    }
}
