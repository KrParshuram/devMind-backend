import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GithubRepo",
      default: null,
      index: true,
    },

    title: {
      type: String,
      default: "New Conversation",
      trim: true,
    },

    knowledgeScope: {
      type: {
        type: String,
        enum: ["none", "all", "collection", "repository"],
        default: "all",
      },

      collectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Collection",
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({
  userId: 1,
  updatedAt: -1,
});

conversationSchema.index({
  userId: 1,
  repoId: 1,
  updatedAt: -1,
});

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema
);

export default Conversation;