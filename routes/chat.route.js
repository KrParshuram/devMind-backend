
import express from 'express';
import  {authMiddleware}from "../middleware/auth.middleware.js";
import {createConversation,messagePerConvo,getConversations} from "../controllers/chat.controller.js";
import {sendMessage} from "../controllers/conversation.controller.js"

const router = express.Router();

router.post('/conversations',authMiddleware,createConversation);
router.get('/conversations',authMiddleware,getConversations);
router.get('/conversations/:conversationId/messages',authMiddleware,messagePerConvo);
router.post('/conversations/:conversationId/messages',authMiddleware,sendMessage);
export default router;