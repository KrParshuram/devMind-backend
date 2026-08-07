import express from "express";
import { query } from "../controllers/query.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import rateLimit from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post('/', authMiddleware, rateLimit({ limit: 20, window: 3600, prefix: 'query' }), query);

export default router;