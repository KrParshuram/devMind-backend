import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export const generateAnswer = async ({
  history,
  retrievedChunks,
  question,
}) => {

  // -----------------------------
  // 1. Format conversation history
  // -----------------------------

  const formattedHistory = history
    .map((message) => {
      return `${message.role}: ${message.content}`;
    })
    .join("\n");

  // -----------------------------
  // 2. Format RAG context
  // -----------------------------

  const formattedContext = retrievedChunks
    .map((chunk, index) => {
      return `Source ${index + 1}:
Title: ${chunk.title}
Content: ${chunk.text}`;
    })
    .join("\n\n");

  // -----------------------------
  // 3. Build prompt
  // -----------------------------

  const prompt = `
You are DevMind, an AI assistant that helps users understand
information from their saved knowledge.

You have access to:

1. Previous conversation history
2. Relevant information retrieved from the user's saved resources
3. The user's current question

RULES:

- Answer the current question naturally and directly.
- Use the saved-resource knowledge when it is relevant.
- Use conversation history to understand follow-up questions.
- Do not invent facts that are not supported by the available knowledge.
- If the user asks something that cannot be answered from the saved
  resources, clearly say that the information is not available in
  their saved resources.
- Do not mention internal retrieval, embeddings, Redis, or RAG.
- Do not blindly repeat the context.
- If multiple sources provide useful information, combine them.

CONVERSATION HISTORY:
${formattedHistory || "No previous conversation."}

SAVED KNOWLEDGE:
${formattedContext || "No saved knowledge available."}

CURRENT QUESTION:
${question}

ANSWER:
`;

  // -----------------------------
  // 4. Call LLM
  // -----------------------------

  const response = await cohere.chat({
    model: "command-r7b-12-2024",
    message: prompt,
  });

  // -----------------------------
  // 5. Return answer
  // -----------------------------

  return response.text;
};


export const generateAnswerStream = async ({
  history,
  retrievedChunks,
  question,
  onToken,
}) => {

  // 1. Format conversation history
  const formattedHistory = history
    .map((message) => {
      return `${message.role}: ${message.content}`;
    })
    .join("\n");

  // 2. Format retrieved knowledge
  const formattedContext = retrievedChunks
    .map((chunk, index) => {
      return `Source ${index + 1}:
Title: ${chunk.title}
Content: ${chunk.text}`;
    })
    .join("\n\n");

  // 3. Build prompt
  const prompt = `
You are DevMind, an AI assistant that helps users understand
information from their saved knowledge.

CONVERSATION HISTORY:
${formattedHistory || "No previous conversation."}

SAVED KNOWLEDGE:
${formattedContext || "No saved knowledge available."}

CURRENT QUESTION:
${question}

RULES:

- Answer naturally and directly.
- Use saved knowledge when relevant.
- Use conversation history for follow-up questions.
- Do not invent information.
- If the answer is not available in the saved resources,
  clearly say so.
- Do not mention embeddings, Redis, retrieval, or RAG.

ANSWER:
`;

  // 4. Start streaming
  const stream = await cohere.chatStream({
    model: "command-r7b-12-2024",
    message: prompt,
  });

  // 5. Receive tokens
  for await (const event of stream) {

    if (event.eventType === "text-generation") {

      const token = event.text;

      if (token) {
        onToken(token);
      }
    }
  }
};