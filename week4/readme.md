# 🎬 Two-Tower Deep Learning Movie Recommender (TensorFlow.js)

This project is a **fully client-side Movie Recommendation System** built using **TensorFlow.js** and the **MovieLens 100K** dataset.  
It demonstrates a **Two-Tower retrieval model** architecture — a modern deep learning approach used in real-world systems like YouTube, Netflix, and Spotify.

---

## 🚀 Features

✅ Pure **in-browser training** with TensorFlow.js  
✅ No Python or backend server needed — runs directly on GitHub Pages  
✅ Implements a **Two-Tower model** (User tower + Item tower)  
✅ Adds **MLP (Deep Learning)** layers for non-linear feature learning  
✅ Uses **Movie Genres** as item features  
✅ Visualizes:
- Live loss chart during training  
- 2D embedding projection (PCA approximation)
✅ Shows three tables:
1. User’s Top-10 rated movies  
2. Standard Two-Tower recommendations  
3. Deep Learning (MLP-enhanced) recommendations  

---

## 🧠 Model Architecture

### **1. Two-Tower Base Model**
- Each user and movie gets an **embedding vector** (latent representation).
- The score between a user and a movie = **dot product** of their embeddings.
- Training objective: contrastive loss using **in-batch negatives**.

### **2. Two-Tower + Deep Learning Model**
- Adds an **MLP (Multi-Layer Perceptron)** above the embeddings.
- Learns deeper, non-linear relationships between users and movies.
- Produces more accurate, personalized recommendations.

### **3. Genre-Based Item Features**
- Each movie embedding is combined with its genre vector.
- The model learns to understand genre similarity between movies.

---
🧠 1. MLP with at least one hidden layer
➡ Where it appears: In two-tower.js inside the deep version of the model (likely named TwoTowerDeepModel or inside a flag like useMLP = true).
You’ll see code like:
// After getting user and item embeddings:
const combined = tf.concat([uEmb, iEmb], 1);

// Deep network layers
const hidden1 = tf.layers.dense({units: 64, activation: 'relu'}).apply(combined);
const hidden2 = tf.layers.dense({units: 32, activation: 'relu'}).apply(hidden1);
const output = tf.layers.dense({units: 1, activation: 'sigmoid'}).apply(hidden2);

👉 This part makes it a Deep Two-Tower model.
You can mention:
“Here we add hidden layers to capture non-linear patterns between users and items.”

🎬 2. Use Genres Information as Item Features
➡ Where it appears: In data.js or at the start of app.js, during item parsing.
You’ll see something like:
// During item parsing
const genreVector = line.slice(5, 24).map(Number); // 19 genre flags
items.set(itemId, { title, year, genreVector });

Later, when building the item tower, the genre vector is concatenated to the movie embedding before passing to the MLP:
const itemEmb = model.itemForward(itemIdx);
const fullItemFeature = tf.concat([itemEmb, tf.tensor(genreVector)], 1);

👉 This allows the model to learn that, for example, a user who likes Action + Sci-Fi movies might also enjoy Adventure.

👤 3. (Optional) User Features
➡ If you have user metadata (like age, gender, occupation) in u.user (another MovieLens file), you can extend the user tower similarly:
const userFeature = tf.tensor([...]); 
const fullUserFeature = tf.concat([userEmb, userFeature], 1);

If you don’t include this, it’s fine — your professor marked it as optional.

📊 4. Comparison Between Baseline and Deep Learning Models
➡ Where it appears in UI / app.js:
After training both models, the Test phase will render three columns instead of two:
User’s Top-10 RatedBaseline Two-Tower RecommendationsDeep Learning (MLP) Recommendations
Code snippet (in app.js):
renderComparisonTable(userTopRated, baselineRecs, deepRecs);

You’ll see HTML construction like:
<table id="comparison-table">
  <thead><tr><th>Top-Rated</th><th>Baseline</th><th>Deep Model</th></tr></thead>
  <tbody> ... </tbody>
</table>

👉 That’s your comparison table.
During your presentation, you can show it and explain:
“The first column shows the user’s historical favorites, the second shows what the baseline Two-Tower recommends, and the third shows recommendations from the Deep Learning model using MLP + genre information.”

🧩 Summary — Where Each Requirement Lives
RequirementFileCode Area / Function
MLP with hidden layer
two-tower.js
TwoTowerDeepModel or inside createDeepModel()
Use Genres as item features
data.js + app.js
When parsing u.item and when creating item tower input
(Optional) User features
data.js (if added)
Similar logic for user attributes
Comparison (with vs without DL)
app.js
In testModel() / renderComparisonTable()

---

## 📂 File Structure

/index.html → Main web page and UI
/app.js → Data loading, training, testing logic
/two-tower.js → Two-Tower + MLP model implementation
/data/u.data → MovieLens user ratings
/data/u.item → Movie metadata (ID, title, genres)

yaml
Copy code

---

## ⚙️ How to Run

1. **Clone or download** this repository.
2. Place `u.data` and `u.item` files inside the `data/` folder.
3. Open `index.html` directly in your browser, or host it on **GitHub Pages**.
4. Click the buttons in order:
   - **Load Data** → loads and parses MovieLens files  
   - **Train** → starts in-browser training (shows live loss chart)  
   - **Test** → picks a random user and displays:
     - Top-10 rated movies
     - Top-10 recommended movies (baseline)
     - Top-10 recommended movies (Deep Learning MLP)

---

## 📊 Visualization

After training:
- A **loss curve** shows training progress.
- A **2D projection** (PCA-like) of item embeddings is displayed.
- Hover over points to see movie titles.

---

## 🧩 Technology Stack

- **TensorFlow.js** — Machine Learning in the browser  
- **HTML5 + CSS3 + JavaScript** — Front-end implementation  
- **MovieLens 100K** — Public movie rating dataset  

---

## 💡 Tips

- Training takes 10–30 seconds depending on browser speed.  
- You can modify embedding dimension or epochs in `app.js` configuration.  
- Works fully offline after data is cached.  
- No server or Python setup required!

---

## 🧑‍💻 Credits

Created by: *Koyam Moopa Mohammad Sinan*  
Role: Front-end ML Engineer (Student Project)  
Course: Recommended Systems

---

## 📚 References

- [MovieLens 100K Dataset](https://grouplens.org/datasets/movielens/)  
- [TensorFlow.js Documentation](https://www.tensorflow.org/js)  
- [Two-Tower Retrieval Models (TFRS)](https://www.tensorflow.org/recommenders/examples/basic_retrieval)

---

