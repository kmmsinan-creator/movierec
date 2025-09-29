# Matrix Factorization Movie Recommender (in-browser with TensorFlow.js)

## Overview
This demo shows how to implement **Matrix Factorization** (collaborative filtering) entirely in the browser using **TensorFlow.js**. The app:
- Loads the MovieLens 100K dataset (`u.item` and `u.data`) from local files.
- Parses the movie metadata and rating triples.
- Builds a small matrix factorization model with user & movie embeddings and biases.
- Trains the model in-browser and displays live training status.
- Predicts a rating for a chosen user & movie pair.

UI is styled in a Netflix-like theme and uses poster placeholders for visual appeal.

---

## Files
- `index.html` — main page; loads TensorFlow.js, `data.js`, and `script.js`.
- `style.css` — Netflix-like styling for the UI.
- `data.js` — loads and parses `u.item` and `u.data`; constructs zero-based index mappings.
- `script.js` — defines the TF.js model, prepares training tensors, trains the model, and provides `predictRating()`.

---

## How it works (high level)
1. **Data parsing** (`data.js`)  
   - `u.item` → movies with genres  
   - `u.data` → rating triples (userId, itemId, rating)  
   - We create zero-based index mappings for users and movies (`userIdToIndex`, `movieIdToIndex`) so embeddings can use contiguous indices.

2. **Model** (`script.js`)  
   - Two embedding layers: user and movie embeddings (size `latentDim`).  
   - Optional user & movie bias embeddings.  
   - Dot product of user and movie vectors gives the base predicted rating; biases and a final linear dense layer refine the prediction.

3. **Training**  
   - The app converts ratings into tensors (`[userIndex, movieIndex]`) and trains the model with `meanSquaredError` using Adam optimizer.
   - Training runs in the browser; progress is shown in the "Status" area.

4. **Prediction**  
   - Choose a user and movie, click **Predict Rating**, and the app outputs the model's predicted rating (clipped to `[1,5]`) in the UI.

---

## Usage
1. Put `u.item` and `u.data` next to the HTML/CSS/JS files.
2. Open `index.html` in a modern browser (Chrome/Edge – recommended).
3. Wait for data to load; the model will start training automatically.
4. After training finishes, pick a user and a movie and click **Predict Rating**.

---

## Notes & Tips
- Training runs on CPU/WebGL in the browser; reduce `latentDim` or `epochs` if the browser is slow.
- The model uses small embeddings and few epochs for demo purposes — increasing `latentDim` and epochs will improve quality but cost time/CPU.
- This example focuses on clarity and education; production recommenders require larger, more robust pipelines and hyperparameter tuning.

---

## License / Attribution
MovieLens 100K dataset © GroupLens Research. This demo is for educational use.
