import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY
});

async function embedChunks(chunks) {
  const response = await cohere.embed({
    texts: chunks,
    model: "embed-english-v3.0",
    inputType: "search_document"  // use this for storing documents
  });

  return response.embeddings;  // array of vectors, one per chunk
}

export default embedChunks;