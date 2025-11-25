/********************************************************************
 two-tower.js — Minimal Two-Tower model in TensorFlow.js.

 User tower: user_id → embedding
 Item tower: item_id → embedding
 Scoring: dot product
 Loss: In-batch softmax (sampled-softmax style)
********************************************************************/

class TwoTowerModel {
    constructor(numUsers, numItems, embDim) {
        this.numUsers = numUsers;
        this.numItems = numItems;
        this.embDim = embDim;

        // Trainable embeddings
        this.userEmbedding = tf.variable(
            tf.randomNormal([numUsers, embDim], 0, 0.05)
        );
        this.itemEmbedding = tf.variable(
            tf.randomNormal([numItems, embDim], 0, 0.05)
        );
    }

    /************* Forward *************/
    userForward(userIdxTensor) {
        return tf.gather(this.userEmbedding, userIdxTensor);
    }

    itemForward(itemIdxTensor) {
        return tf.gather(this.itemEmbedding, itemIdxTensor);
    }

    score(uEmb, iEmb) {
        return tf.sum(tf.mul(uEmb, iEmb), -1); // dot product
    }

    /************* In-batch Softmax Loss *************/
    trainStep(uIdx, iIdxPos) {
        return tf.tidy(() => {
            const uEmb = this.userForward(uIdx);      // [B, D]
            const iEmb = this.itemForward(iIdxPos);  // [B, D]

            const logits = tf.matMul(uEmb, iEmb.transpose()); // [B,B]
            const labels = tf.range(0, logits.shape[0], 1, 'int32'); // diagonal positives

            const loss = tf.losses.softmaxCrossEntropy(
                tf.oneHot(labels, logits.shape[1]),
                logits
            ).mean();

            return loss;
        });
    }

    /************* Inference Helpers *************/
    getUserEmbedding(uIdxTensor) {
        return this.userForward(uIdxTensor); // returns [1, D]
    }

    getScoresForAllItems(uEmb, itemEmbMatrix) {
        return tf.matMul(uEmb, itemEmbMatrix.transpose()); // [1, numItems]
    }
}
