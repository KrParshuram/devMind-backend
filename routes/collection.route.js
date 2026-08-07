
// import the controller functions -- createCollection , getCollection , deleteCollection 
//import the authMiddleware -- as this is needed for to get the userId 
//express is needed to create a new route for the collections 

import {createCollection , getCollection , deleteCollection,getCollectionResources,addResourcesToCollection} from "../controllers/collection.controller.js";
import  {authMiddleware}from "../middleware/auth.middleware.js";
import express from 'express';


const router = express.Router();

router.post('/', authMiddleware, createCollection);
router.get('/', authMiddleware, getCollection);
router.post('/:id/resources', authMiddleware, addResourcesToCollection);
router.delete('/:id', authMiddleware, deleteCollection);
router.get('/:id/resources',authMiddleware, getCollectionResources);

export default router;