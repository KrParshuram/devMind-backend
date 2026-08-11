import { CohereClient } from "cohere-ai";
import client from "../config/redis.js";
import cosineSimilarity from "./similarity.service.js";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

async function embedQuery(question) {
  const response = await cohere.embed({
    texts: [question],
    model: "embed-english-v3.0",
    inputType: "search_query",
  });

  return response.embeddings[0];
}

export const retrieveRelevantChunks = async ({
  question,
  userId,
  knowledgeScope,
}) => {
  // --------------------------------
  // 1. No knowledge base
  // --------------------------------

  if (knowledgeScope.type === "none") {
    return [];
  }

  // --------------------------------
  // 2. Create question embedding
  // --------------------------------

  const questionEmbedding = await embedQuery(question);

  // --------------------------------
  // 3. Get user's chunk keys
  // --------------------------------

  const keys = await client.keys(`chunk:${userId}:*`);

  const similarityScore = [];

  // --------------------------------
  // 4. Retrieve + filter + similarity
  // --------------------------------

  for (const key of keys) {
    const value = await client.get(key);

    if (!value) continue;

    const parsedValue = JSON.parse(value);

    // Security check
    if (parsedValue.userId !== userId) {
      continue;
    }

    // Collection scope
    if (
      knowledgeScope.type === "collection" &&
      parsedValue.collectionId !== knowledgeScope.collectionId
    ) {
      continue;
    }

    const score = cosineSimilarity(
      questionEmbedding,
      parsedValue.embeddings
    );

    similarityScore.push({
      ...parsedValue,
      score,
    });
  }

  // --------------------------------
  // 5. Sort + Top K
  // --------------------------------

  return similarityScore
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
};


