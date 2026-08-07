import {createResource , getResource , resource,createFileResource,deleteResource} from "../controllers/resource.controller.js";
import {authMiddleware} from "../middleware/auth.middleware.js";
import rateLimit from "../middleware/rateLimit.middleware.js";
import upload from "../middleware/upload.middleware.js";
import express from 'express';

const router = express.Router();


router.post('/resource/upload', authMiddleware, upload.single('file'), createFileResource);
// 50 saves per day
router.post('/resource', authMiddleware, rateLimit({ limit: 50, window: 86400, prefix: 'save' }), createResource);
router.get("/resource" , authMiddleware, getResource);
router.get("/resource/:id" , authMiddleware, resource);
router.delete('/resource/:id', authMiddleware, deleteResource);

export default router;