import { CohereClient } from "cohere-ai";
import client from "../config/redis.js"; 
import cosineSimilarity from "../services/similarity.service.js"


const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY
});


async function embedChunks(chunks) {
  const response = await cohere.embed({
    texts: chunks,
    model: "embed-english-v3.0",
    inputType: "search_query"  // use this for storing documents
  });

  return response.embeddings;  // array of vectors, one per chunk
}




export const query = async (req, res) => {
  try {
    // 1. get question from req.body

    const {question} = req.body;

    // 2. get userId from req.user.id

    const userId = req.user.id;
    // 3. embed question using Cohere (inputType: "search_query")
    const queryEmbeddings = await embedChunks([question]);
    const questionEmbedding = queryEmbeddings[0];


    // 4. get all keys from Redis matching "chunk:*"
    const keys = await client.keys(`chunk:${userId}:*`);
    // 5. for each key — get value, parse JSON, calculate cosine similarity
    let totalKey = keys.length;
    let similarityScore = [];

    for(let i=0; i<totalKey;i++){
        const value = await client.get(keys[i]);

        const parsedValue = JSON.parse(value);

        const score = cosineSimilarity(questionEmbedding , parsedValue.embeddings) ;
        
        similarityScore.push({...parsedValue , score});



    }
    // 6. sort by similarity, take top 5
    const top5 = similarityScore.sort((a,b) => b.score - a.score ).slice(0,5);
    // 7. build prompt with top 5 chunks as context
    const context = top5.map((chunk, i) => `Source ${i + 1}: ${chunk.text}`).join("\n\n");

        const prompt = `You are a helpful assistant. Answer the user's question based ONLY on the provided context. If the answer is not in the context, say "I don't have enough information about this in your saved resources."

        Context:
        ${context}

        Question: ${question}

        Answer:`;


    // 8. send to LLM
    const response = await cohere.chat({
    model: "command-r7b-12-2024",
    message: prompt,
    });

    const answer = response.text;
    // 9. return answer
    return res.status(200).json({
        answer:answer , 
        message:"successfull"
    })
  } catch(err) {
    return res.status(500).json({ error: err });
  }
}