# Matrix Factorization Movie Recommender (TensorFlow.js)

## 1. Context
The goal of this project is to build a web application that demonstrates Matrix Factorization for collaborative filtering.
It parses the MovieLens 100K dataset (u.item, u.data), trains a recommendation model entirely in the browser using TensorFlow.js, and predicts how much a selected user would rate a selected movie.

The project is modular:

- data.js → loads and parses the dataset
- script.js → defines, trains, and runs the TensorFlow.js model
- index.html + style.css → user interface

## 2. Output Format
The project consists of four main files:

- index.html
- style.css
- data.js
- script.js

## 3. index.html Instructions
- Include a title and a main heading.
- Provide two dropdown menus:
  - #user-select → for selecting a user
  - #movie-select → for selecting a movie
- Add a "Predict Rating" button that triggers the predictRating() function.
- Include a result area (#result) to display model training status and predictions.
- Load scripts in the correct order at the bottom of <body>:
  - <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
  - <script src="data.js"></script>
  - <script src="script.js"></script>

## 4. style.css Instructions
- Apply a modern, clean, and centered layout.
- Keep the design professional and user-friendly.
- Use consistent styling for dropdowns and buttons.
- Apply responsive design rules to look good on desktop and mobile.
- Follow the modern styling specifications used in previous exercises (container, box shadows, clean typography).

## 5. data.js Instructions
This file handles data loading and parsing.
- Must contain:
  - loadData() → loads both u.item and u.data
  - parseItemData(text) → parses movie information
  - parseRatingData(text) → parses user–movie ratings
- Must also store dataset dimensions in:
  - numUsers
  - numMovies

## 6. script.js Instructions
This file contains the TensorFlow.js model definition, training, and prediction logic.

### Global Variables
- model → holds the trained TensorFlow.js model

### Initialization (window.onload)
- Wait for loadData() from data.js
- Populate dropdowns for users and movies
- Call trainModel() to start model training
- Update UI with a message while the model is training

### Model Definition Function: createModel(numUsers, numMovies, latentDim)
This function defines the Matrix Factorization model.
- Inputs:
  - userInput → user IDs
  - movieInput → movie IDs

- Embedding Layers:
  - User embedding → tf.layers.embedding({ inputDim: numUsers, outputDim: latentDim })
  - Movie embedding → tf.layers.embedding({ inputDim: numMovies, outputDim: latentDim })

- Latent Vectors:
  - Flatten embeddings into userVec and movieVec

- Prediction:
  - Compute dot product between userVec and movieVec
  - Pass result through a dense layer (tf.layers.dense({ units: 1 })) to predict rating

- Model Creation:
  - Return a tf.model with defined inputs and output

### Training Function: trainModel()
1. Call createModel() to build architecture

2. Compile the model:
   - Optimizer → tf.train.adam(0.001)
   - Loss → 'meanSquaredError'
3. Prepare training data:
   - Convert user IDs, item IDs, and ratings into tensors (tf.tensor2d)

4. Train with model.fit():
   - Epochs: 5–10
   - Batch size: 64

5. After training completes, update UI to say Model Ready

### Prediction Function: predictRating()
- Triggered by "Predict Rating" button
- Steps:
  1. Get selected user ID and movie ID from dropdowns
  2. Convert into tensors
  3. Call model.predict()
  4. Extract predicted rating with .data()
  5. Display result in #result area
