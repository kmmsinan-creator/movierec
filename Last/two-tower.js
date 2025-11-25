two-tower.js
/********************************************************************
 two-tower.js — Minimal Two-Tower model in TensorFlow.js.

 - User tower: user_id -> embedding table
 - Item tower: item_id -> embedding table
 - Scoring: dot product
 - Loss: In-batch sampled-softmax (softmax cross entropy over in-batch items)
 
 Comments:
 - Two-tower is efficient for candidate generation: precompute item embeddings,
   compute user embedding at request time and do a fast dot-product similarity.
 - In-batch negatives: each positive item in the batch acts as a negative for other users.
********************************************************************/

class TwoTowerModel {
  constructor(numUsers, numItems, embDim = 32) {
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;

    // Embedding tables (trainable)
    this.userEmbedding = tf.variable(tf.randomNormal([numUsers, embDim], 0, 0.05));
    this.itemEmbedding = tf.variable(tf.randomNormal([numItems, embDim], 0, 0.05));
  }

  // Gather user embeddings for given user indices tensor (int32 1D)
  userForward(userIdxTensor) {
    return tf.gather(this.userEmbedding, userIdxTensor);
  }

  // Gather item embeddings for given item indices tensor (int32 1D)
  itemForward(itemIdxTensor) {
    return tf.gather(this.itemEmbedding, itemIdxTensor);
  }

  // Dot product score between user embeddings [B, D] and item embeddings [B, D] (returns [B])
  score(uEmb, iEmb) {
    return tf.sum(tf.mul(uEmb, iEmb), -1);
  }

  // Train step: in-batch softmax.
  // For batch of size B: U [B,D], Ipos [B,D] -> logits [B,B] = U @ Ipos^T
  // labels = one-hot diag (each u's positive is the diagonal).
  trainStep(uIdxTensor, iIdxPosTensor) {
    return tf.tidy(() => {
      const uEmb = this.userForward(uIdxTensor);    // [B, D]
      const iEmb = this.itemForward(iIdxPosTensor); // [B, D]
      const logits = tf.matMul(uEmb, iEmb, false, true); // [B, B]
      const labels = tf.oneHot(tf.range(0, logits.shape[0], 1, 'int32'), logits.shape[1]);
      const loss = tf.losses.softmaxCrossEntropy(labels, logits).mean();
      return loss;
    });
  }

  // Inference helpers
  getUserEmbedding(uIdxTensor) {
    // returns [1, D] or [B, D]
    return this.userForward(uIdxTensor);
  }

  // getScoresForAllItems: compute scores of uEmb [1, D] vs full itemEmb matrix [N, D]
  getScoresForAllItems(uEmb, itemEmbMatrix) {
    return tf.matMul(uEmb, itemEmbMatrix, false, true); // [1, N]
  }
}
