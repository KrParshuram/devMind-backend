import mongoose from "mongoose";
import Conversation from "../model/conversation.model.js";
import Collection from "../model/collection.model.js";
// import Collection from "../model/collection.model.js";
import GithubRepo from "../model/github.repo.model.js";
import Message from "../model/Message.model.js";

export const createConversation = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      knowledgeScope,
      repoId = null,
    } = req.body;

    // -----------------------------------------
    // 1. Validate knowledgeScope
    // -----------------------------------------

    if (!knowledgeScope || !knowledgeScope.type) {
      return res.status(400).json({
        message: "knowledgeScope is required",
      });
    }

    const { type, collectionId } = knowledgeScope;

    // -----------------------------------------
    // 2. Validate scope type
    // -----------------------------------------

    if (!["all", "none", "collection", "repository"].includes(type)) {
      return res.status(400).json({
        message: "Invalid knowledgeScope type",
      });
    }

    // -----------------------------------------
    // 3. Repository validation
    // -----------------------------------------

    if (type === "repository") {

      // repoId is required
      if (!repoId) {
        return res.status(400).json({
          message: "repoId is required for repository scope",
        });
      }

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(repoId)) {
        return res.status(400).json({
          message: "Invalid repoId",
        });
      }

      // Check repository belongs to user
      const repo = await GithubRepo.findOne({
        _id: repoId,
        userId,
      });

      if (!repo) {
        return res.status(404).json({
          message: "Repository not found",
        });
      }
    }

    // -----------------------------------------
    // 4. Collection validation
    // -----------------------------------------

    if (type === "collection") {

      if (!collectionId) {
        return res.status(400).json({
          message: "collectionId is required for collection scope",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(collectionId)) {
        return res.status(400).json({
          message: "Invalid collectionId",
        });
      }

      const collection = await Collection.findOne({
        _id: collectionId,
        userId,
      });

      if (!collection) {
        return res.status(404).json({
          message: "Collection not found",
        });
      }
    }

    // -----------------------------------------
    // 5. Create conversation
    // -----------------------------------------

    const newConversation = await Conversation.create({
      userId,

      repoId: type === "repository"
        ? repoId
        : null,

      title: "New Conversation",

      knowledgeScope: {
        type,

        collectionId:
          type === "collection"
            ? collectionId
            : null,
      },
    });

    // -----------------------------------------
    // 6. Return response
    // -----------------------------------------

    return res.status(201).json({
      message: "Conversation created successfully",

      conversation: newConversation,
    });

  } catch (error) {

    console.error(
      "Create conversation error:",
      error
    );

    return res.status(500).json({
      message: "Problem while creating conversation",
    });
  }
};


export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      userId,
    })
      .select("title repoId knowledgeScope createdAt updatedAt")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return res.status(500).json({
      message: "Problem while fetching conversations",
    });
  }
};


export const messagePerConvo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // 1. Verify that the conversation belongs to the user
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    // 2. Get messages for this conversation
    const messages = await Message.find({
      conversationId,
    }).sort({ createdAt: 1 });

    // 3. Return messages
    return res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Get conversation messages error:", error);

    return res.status(500).json({
      message: "Problem while fetching messages",
    });
  }
};