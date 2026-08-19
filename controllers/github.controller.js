import GithubRepo from "../model/github.repo.model.js";
import RepoIndexing from "../queues/repo.queue.js"
import { runRepoAgent } from "../services/repoAgent.service.js";
import Message from "../model/Message.model.js";
import Conversation from "../model/conversation.model.js";


async function addToRepoqueue(repoId, userId, owner, name, branch) {

  try {

    console.log("ADDING REPO JOB:", {
      repoId,
      userId,
      owner,
      name,
      branch
    });

    const job = await RepoIndexing.add("index-repository", {
      repoId,
      userId,
      owner,
      name,
      branch
    });

    console.log(
      `Job added Successfully with JOB ID: ${job.id}`
    );

  } catch (error) {

    console.error(
      "Failed to add job to queue:",
      error
    );

    throw error;
  }
}


export const indexRepo = async (req , res) => {
            const { repoUrl, branch} = req.body;
            const userId = req.user.id;

            if (!repoUrl) {
                return res.status(400).json({
                    message: "repoUrl is required"
                });
            }

            let urlParts;
    try{
//     body: { repoUrl, branch }

// 1. parse owner and name from repoUrl
//    "https://github.com/KrParshuram/devMind-backend"
//    → owner: "KrParshuram", name: "devMind-backend"
        const url = new URL(repoUrl)
        if (url.hostname !== "github.com") {
        return res.status(400).json({
            message: "Only GitHub repository URLs are supported"
        });
    }
        const urlParts = url.pathname.split('/').filter(Boolean);
        if(urlParts.length < 2){
            return res.status(400).json({"message":"Repo URl is Invalid"})
        }
        const owner = urlParts[0];
        const name = urlParts[1];

        const existingRepo = await GithubRepo.findOne({repoUrl,userId});
        if(existingRepo){
            return res.status(400).json({
                "message":"Github Repo is already indexed"
            })
        }

   
        const newRepo = await GithubRepo.create({
            userId ,
            repoUrl,
            owner,
            name ,
            branch ,
            status: "pending"

        })

        
// 2. save to MongoDB (status: "pending")

// 3. add job to RepoIndexing queue
        await addToRepoqueue(newRepo._id , userId,owner,name ,branch);

// 4. return repo
        return res.status(202).json({"message":"Indexing started for new Repo in DB " , "Repo":newRepo})

    }catch(err){
        throw new Error(`Getting Error while creating new Repo in DB --${err}`);
    }

}

export const getRepos = async(req,res) => {

    try{
        const userId = req.user.id;

        const allRepos = await GithubRepo.find({userId});

        return res.status(200).json({
            "Repos":allRepos
        })

    }catch(err){
        throw new Error(`Error while getting all repos for the user ${err}`)
        
    }
}

export const chatWithRepo = async (req, res) => {
  // -----------------------------
  // SSE HEADERS
  // -----------------------------

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  try {
    // -----------------------------
    // 1. Get request data
    // -----------------------------

    const { question, conversationId } = req.body;

    const userId = req.user.id;
    const { repoId } = req.params;

    // -----------------------------
    // 2. Validate question
    // -----------------------------

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
    // 3. Find repository
    // -----------------------------

    const repo = await GithubRepo.findOne({
      _id: repoId,
      userId,
    });

    if (!repo) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Repo not found",
        })}\n\n`
      );

      return res.end();
    }

    // -----------------------------
    // 4. Check repo indexing
    // -----------------------------

    if (repo.status !== "ready") {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Repo is still being indexed",
        })}\n\n`
      );

      return res.end();
    }

    // -----------------------------
    // 5. Find/Create conversation
    // -----------------------------

    let conversation;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId,
        repoId,
      });

      if (!conversation) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: "Conversation not found",
          })}\n\n`
        );

        return res.end();
      }
    } else {
      conversation = await Conversation.create({
        userId,
        repoId,
        title: question.slice(0, 80),
         knowledgeScope: {
      type: "repository",
      collectionId: null,
    },
      });

      // Send conversation ID immediately
      res.write(
        `data: ${JSON.stringify({
          type: "conversation",
          conversationId: conversation._id,
        })}\n\n`
      );
    }

    // -----------------------------
    // 6. Save user message
    // -----------------------------

    const userMessage = await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: question,
      status: "completed",
    });

    // Send user message ID
    res.write(
      `data: ${JSON.stringify({
        type: "user_message",
        messageId: userMessage._id,
      })}\n\n`
    );

    // -----------------------------
    // 7. Create assistant message
    // -----------------------------

    const assistantMessage = await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: "",
      status: "pending",
    });

    // -----------------------------
    // 8. Mark assistant streaming
    // -----------------------------

    assistantMessage.status = "streaming";
    await assistantMessage.save();

    const previousMessages = await Message.find({
  conversationId: conversation._id,
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    previousMessages.reverse();

    // -----------------------------
    // 9. Run repo agent
    // -----------------------------

    let fullAnswer = "";

    const answer = await runRepoAgent(
      question,
      repoId,
      userId,
      repo.owner,
      repo.name,
      previousMessages,
      {
        onToken: (token) => {
          fullAnswer += token;

          res.write(
            `data: ${JSON.stringify({
              type: "token",
              content: token,
            })}\n\n`
          );
        },
      }
    );

    // -----------------------------
    // 10. Fallback if agent
    // doesn't stream
    // -----------------------------

    if (!fullAnswer && answer) {
      fullAnswer = answer;

      res.write(
        `data: ${JSON.stringify({
          type: "token",
          content: answer,
        })}\n\n`
      );
    }

    // -----------------------------
    // 11. Save assistant answer
    // -----------------------------

    assistantMessage.content = fullAnswer;
    assistantMessage.status = "completed";

    await assistantMessage.save();

    // -----------------------------
    // 12. Update conversation
    // -----------------------------

    conversation.updatedAt = new Date();

    await conversation.save();

    // -----------------------------
    // 13. Send final event
    // -----------------------------

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        conversationId: conversation._id,
        messageId: assistantMessage._id,
      })}\n\n`
    );

    // -----------------------------
    // 14. Close SSE
    // -----------------------------

    res.end();

  } catch (error) {

    console.error("Repo chat error:", error);

    // If assistant message exists, mark failed
    // You can keep this outside if you want cleaner scope.

    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Failed to generate response",
        })}\n\n`
      );

      return res.end();
    }

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};