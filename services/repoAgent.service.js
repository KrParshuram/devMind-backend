import { tool } from "@langchain/core/tools";
import { z } from "zod";
import client from "../config/redis.js";
import { CohereEmbeddings } from "@langchain/cohere";
import cosineSimilarity from "./similarity.service.js";
import RepoFile from "../model/repo.file.model.js"
import {getFileContent} from "./github.service.js"
import { ChatCohere } from "@langchain/cohere";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage  } from "@langchain/core/messages";



const llm = new ChatCohere({
  model: "command-a-03-2025",
  temperature: 0,
  apiKey: process.env.COHERE_API_KEY,
});

const embeddings = new CohereEmbeddings({
  apiKey: process.env.COHERE_API_KEY,
  model: "embed-english-v3.0",
});

// Tool 1 — search code chunks in Redis
const searchCode = tool(
  async ({ query, repoId, userId }) => {
    // 1. embed the query
    const vector = await embeddings.embedQuery(query);

    // 2. get all keys: repoChunk:{userId}:{repoId}:*
    const keys = await client.keys(`repoChunk:${userId}:${repoId}:*`);

    // 3. calculate cosine similarity
      const similarityScore = [];

  for (const key of keys) {
    const value = await client.get(key);

    if (!value) continue;

    const parsedValue = JSON.parse(value);


    const score = cosineSimilarity(
      vector,
      parsedValue.embedding
    );

    similarityScore.push({
      ...parsedValue,
      score,
    });
  }


    // 4. return top 5 chunks
    return similarityScore
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  },
  {
    name: "searchCode",
    description: "Search through indexed repository code using a natural language query. Use this to find relevant code snippets.",
    schema: z.object({
      query: z.string(),
      repoId: z.string(),
      userId: z.string(),
    })
  }
);

// Tool 2 — get file structure
const getFileStructure = tool(
  async ({ repoId }) => {
    // fetch all RepoFile documents for this repo
    const allRepoFile = await RepoFile.find({repoId});


    // return list of filePaths
    return allRepoFile;
  },
  {
    name: "getFileStructure",
    description: "Get the file and folder structure of the repository. Use this when user asks about project structure or wants to know what files exist.",
    schema: z.object({
      repoId: z.string(),
    })
  }
);

// Tool 3 — read specific file
const readFile = tool(
  async ({ owner, name, filePath }) => {
    // call getFileContent from github.service.js
    const fileContent =await getFileContent(owner, name, filePath);

    // return file content
    return fileContent;
  },
  {
    name: "readFile",
    description: "Read the full content of a specific file in the repository. Use this when you need to see the complete implementation of a file.",
    schema: z.object({
      owner: z.string(),
      name: z.string(),
      filePath: z.string(),
    })
  }
);

const tools = [searchCode, getFileStructure, readFile];
// bind tools to LLM
const llmWithTools = llm.bindTools(tools);
// create the agent
export const repoAgent = createReactAgent({
  llm: llmWithTools,
  tools,
});

export const runRepoAgent = async (
  question,
  repoId,
  userId,
  owner,
  name,
  previousMessages = [],
  callbacks = {}
) => {
  const { onToken } = callbacks;

  // build message history for context
  
const historyMessages = previousMessages
  .filter(m => m.content?.trim())
  .map(m => {
    if (m.role === "user") {
      return new HumanMessage({
        content: m.content,
      });
    }

    return new AIMessage({
      content: m.content,
    });
  }) || [];

  const messages = [
  ...historyMessages,
  new HumanMessage({
    content: question,
  }),
];

  // system prompt
  const systemPrompt = `You are a code assistant helping analyze a GitHub repository.
RepoId: ${repoId}
UserId: ${userId}
Owner: ${owner}
Repo name: ${name}

When searching code, always pass repoId: "${repoId}" and userId: "${userId}" to searchCode tool.
When reading files, always pass owner: "${owner}" and name: "${name}" to readFile tool.
Think step by step. Use tools to find relevant code before answering.`;

  // stream the agent response
const stream = await repoAgent.stream({
  messages: [
    new SystemMessage(systemPrompt),
    ...messages,
  ],
});

  let fullAnswer = "";

  for await (const chunk of stream) {
    // agent messages come in chunks
    if (chunk.agent?.messages) {
      for (const message of chunk.agent.messages) {
        if (message.content && typeof message.content === "string") {
          const token = message.content;
          fullAnswer += token;
          if (onToken) onToken(token);
        }
      }
    }
  }

  return fullAnswer;
};

export { searchCode, getFileStructure, readFile };