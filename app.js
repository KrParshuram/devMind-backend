import "dotenv/config";

import express from 'express'
import connectDB from "./config/db.js"
import  {errorhandler}  from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import resourceRouter from "./routes/resource.route.js";
import "./workers/resource.worker.js";
import queryRouter from "./routes/query.route.js";
import collectionRouter from "./routes/collection.route.js";
// import client from "./config/redis.js"
import cors from "cors";


const app = express();
app.use(express.json());

connectDB();

console.log(process.env.JWT_SECRET);

app.use(cors({ origin: ["http://localhost:5173","https://devmind-ai-beta.vercel.app"] }));
// public routes
app.use("/api/auth", authRouter);

// protected routes
app.use("/api/user", userRouter);

app.use("/api/user",resourceRouter);

app.use("/api/collections", collectionRouter);

app.use("/api/query", queryRouter);


// error handler — always last
app.use(errorhandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));