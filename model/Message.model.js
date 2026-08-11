import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      default:"",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "streaming",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "completed",
    },

    sources: {
      type: [
        {
          resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Resource",
          },

          chunkId: {
            type: String,
          },

          title: {
            type: String,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({
  conversationId: 1,
  createdAt: 1,
});

const Message = mongoose.model("Message", messageSchema);

export default Message;