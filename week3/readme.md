# 🎬 Matrix Factorization Movie Recommender (TensorFlow.js)

## 📌 1. Context
The goal of this project is to build a **web application** that demonstrates **Matrix Factorization for collaborative filtering**.  
It parses the **MovieLens 100K dataset** (`u.item`, `u.data`), trains a recommendation model entirely in the browser using **TensorFlow.js**, and predicts how much a selected user would rate a selected movie.  

The project is modular:
- `data.js` → loads and parses the dataset  
- `script.js` → defines, trains, and runs the TensorFlow.js model  
- `index.html` + `style.css` → user interface  

---

## 📌 2. Output Format
The project consists of **four main files**:

1. `index.html`  
2. `style.css`  
3. `data.js`  
4. `script.js`

---

## 📌 3. index.html Instructions
- Include a **title** and a **main heading**.  
- Provide two dropdown menus:  
  - `#user-select` → for selecting a user  
  - `#movie-select` → for selecting a movie  
- Add a **"Predict Rating"** button that triggers the `predictRating()` function.  
- Include a **result area** (`#result`) to display model training status and predictions.  
- Load scripts in the correct order at the bottom of `<body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
<script src="data.js"></script>
<script src="script.js"></script>

----
## 📌 4. style.css Instructions
•	Apply a modern, clean, and centered layout.
•	Keep the design professional and user-friendly.
•	Use consistent styling for dropdowns and buttons.
•	Apply responsive design rules to look good on desktop and mobile.
•	Follow the modern styling specifications used in previous exercises (container, box shadows, clean typography).

## 📌 5. data.js Instructions
This file handles data loading and parsing.
•	Must contain:
o	loadData() → loads both u.item and u.data
o	parseItemData(text) → parses movie information
o	parseRatingData(text) → parses user–movie ratings
•	Must also store dataset dimensions in:
o	numUsers
o	numMovies

## 📌 6. script.js Instructions
This file contains the TensorFlow.js model definition, training, and prediction logic.
🔹 Global Variables
•	model → holds the trained TensorFlow.js model

🔹 Initialization (window.onload)
•	Wait for loadData() from data.js
•	Populate dropdowns for users and movies
•	Call trainModel() to start model training
•	Update UI with a message while the model is training

🔹 Model Definition Function: createModel(numUsers, numMovies, latentDim)
This function defines the Matrix Factorization model.
•	Inputs:
o	userInput → user IDs
o	movieInput → movie IDs

•	Embedding Layers:
o	User embedding → tf.layers.embedding({ inputDim: numUsers, outputDim: latentDim })
o	Movie embedding → tf.layers.embedding({ inputDim: numMovies, outputDim: latentDim })

•	Latent Vectors:
o	Flatten embeddings into userVec and movieVec

•	Prediction:
o	Compute dot product between userVec and movieVec
o	Pass result through a dense layer (tf.layers.dense({ units: 1 })) to predict rating

•	Model Creation:
o	Return a tf.model with defined inputs and output

🔹 Training Function: trainModel()
1.	Call createModel() to build architecture

2.	Compile the model:
o	Optimizer → tf.train.adam(0.001)
o	Loss → 'meanSquaredError'
3.	Prepare training data:
o	Convert user IDs, item IDs, and ratings into tensors (tf.tensor2d)

4.	Train with model.fit():
o	Epochs: 5–10
o	Batch size: 64

5.	After training completes, update UI to say Model Ready
🔹 Prediction Function: predictRating()
•	Triggered by "Predict Rating" button
•	Steps:
1.	Get selected user ID and movie ID from dropdowns
2.	Convert into tensors
3.	Call model.predict()
4.	Extract predicted rating with .data()
5.	Display result in #result area

