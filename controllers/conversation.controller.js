import Conversation from "../model/conversation.model.js";
import Message from "../model/Message.model.js";

import { retrieveRelevantChunks } from "../services/retrieval.service.js";
import { buildContext } from "../services/context.service.js";
import { generateAnswerStream } from "../services/llm.service.js";

export const sendMessage = async (req, res) => {
  try {
    // -----------------------------
    // SSE HEADERS
    // -----------------------------

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.flushHeaders();

    // -----------------------------
    // 1. Get userId
    // -----------------------------

    const userId = req.user.id;

    // -----------------------------
    // 2. Get conversationId
    // -----------------------------

    const { conversationId } = req.params;

    // -----------------------------
    // 3. Get question
    // -----------------------------

    const { question } = req.body;

    if (!question?.trim()) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Question is required",
        })}\n\n`
      );

      return res.end();
    }

    // -----------------------------
    // 4. Verify conversation
    // -----------------------------

    const conversationCurrent = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversationCurrent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Conversation not found",
        })}\n\n`
      );

      return res.end();
    }

    // -----------------------------
    // 5. Load previous messages
    // -----------------------------

    const prevMessages = await Message.find({
      conversationId,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    // -----------------------------
    // 6. Save user message
    // -----------------------------

    const userMessage = await Message.create({
      conversationId,
      role: "user",
      content: question,
      status: "completed",
    });

    // -----------------------------
    // 7. Retrieve relevant chunks
    // -----------------------------

    const top5retrievel = await retrieveRelevantChunks({
      question,
      userId,
      knowledgeScope: conversationCurrent.knowledgeScope,
    });

    // -----------------------------
    // 8. Build context
    // -----------------------------

    const context = buildContext({
      messages: prevMessages,
      retrievedChunks: top5retrievel,
      question,
    });

    console.log("CONTEXT:", context);

    // -----------------------------
    // 9. Create assistant message
    // -----------------------------

    const assistantMessage = await Message.create({
      conversationId,
      role: "assistant",
      status: "pending",
    });

    try {
      // -----------------------------
      // 10. Mark streaming
      // -----------------------------

      await Message.findByIdAndUpdate(
        assistantMessage._id,
        {
          status: "streaming",
        }
      );

      // -----------------------------
      // 11. Stream LLM response
      // -----------------------------

      let fullAnswer = "";

      await generateAnswerStream({
        ...context,

        onToken: (token) => {
          fullAnswer += token;

          res.write(
            `data: ${JSON.stringify({
              type: "token",
              content: token,
            })}\n\n`
          );
        },
      });

      // -----------------------------
      // 12. Save completed answer
      // -----------------------------

      assistantMessage.content = fullAnswer;

      assistantMessage.status = "completed";

      assistantMessage.sources = top5retrievel.map((chunk) => ({
        resourceId: chunk.resourceId,
        chunkId: chunk.chunkId || null,
        title: chunk.title,
      }));

      await assistantMessage.save();

      // -----------------------------
      // 13. Update conversation
      // -----------------------------

      conversationCurrent.updatedAt = new Date();

      await conversationCurrent.save();

      // -----------------------------
      // 14. Send final event
      // -----------------------------

      res.write(
        `data: ${JSON.stringify({
          type: "done",
          messageId: assistantMessage._id,
          sources: assistantMessage.sources,
        })}\n\n`
      );

      // -----------------------------
      // 15. Close SSE
      // -----------------------------

      res.end();

    } catch (error) {

      console.error("LLM streaming error:", error);

      await Message.findByIdAndUpdate(
        assistantMessage._id,
        {
          status: "failed",
        }
      );

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Failed to generate response",
        })}\n\n`
      );

      res.end();
    }

  } catch (error) {

    console.error("Send message error:", error);

    // If headers haven't been sent yet
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "Internal server error",
      })}\n\n`
    );

    res.end();
  }
};