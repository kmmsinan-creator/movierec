// Global variables for storing movie and rating data
let movies = [];
let ratings = [];

// Genre names as defined in the u.item file
const genreNames = [
    "Action", "Adventure", "Animation", "Children's", "Comedy", 
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir", 
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi", 
    "Thriller", "War", "Western"
];

/**
 * Async function to load movie and rating data from local files
 */
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
        
        return true;
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('result').textContent = 
            `Error: ${error.message}. Please make sure u.item and u.data files are available.`;
        document.getElementById('result').className = 'error';
        return false;
    }
}

/**
 * Parse movie data from the u.item file format
 * @param {string} text - Raw text content from u.item file
 */
function parseItemData(text) {
    const lines = text.split('\n');
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const fields = line.split('|');
        if (fields.length < 5) continue;
        
        const id = parseInt(fields[0]);
        const title = fields[1];
        const genres = [];
        
        // Extract genre information (fields 6-24)
        for (let i = 5; i < fields.length && i < 23; i++) {
            if (fields[i] === '1') {
                genres.push(genreNames[i - 5]);
            }
        }
        
        movies.push({ id, title, genres });
    }
}

/**
 * Parse rating data from the u.data file format
 * @param {string} text - Raw text content from u.data file
 */
function parseRatingData(text) {
    const lines = text.split('\n');
    
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
