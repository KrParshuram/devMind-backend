import express from 'express'
import {getRepos ,indexRepo,chatWithRepo } from "../controllers/github.controller.js"
import {authMiddleware} from "../middleware/auth.middleware.js"


const router = express.Router();

router.post('/repos' , authMiddleware , indexRepo);
router.get('/repos' , authMiddleware , getRepos)
router.post('/repos/:repoId/chat', authMiddleware, chatWithRepo);

export default router;