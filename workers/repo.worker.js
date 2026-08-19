// 

import { Worker } from "bullmq";
import GithubRepo from "../model/github.repo.model.js";
import RepoFile from "../model/repo.file.model.js"
import client from "../config/redis.js"; 
import {getRepoFiles,getFileContent} from "../services/github.service.js"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CohereEmbeddings } from "@langchain/cohere";

const embeddings = new CohereEmbeddings({
  apiKey: process.env.COHERE_API_KEY,
  model: "embed-english-v3.0",
  inputType: "search_document"
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 200,
});




const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}
};


const worker = new Worker("GithubRepo" , async (job) => {
    
    const  { repoId, userId, owner, name, branch } = job.data;
    try{
  console.log(`Processing job ${job.id} for repo ${repoId}`);

//   1. fetch repo from MongoDB — update status to "indexing"
      const currRepo = await GithubRepo.findOne({ _id: repoId, userId });  // 
      if(!currRepo) {
        throw new Error("No repo found in Database");
      }

      currRepo.status = "indexing";
      await currRepo.save();
// 2. call getRepoFiles(owner, name, branch) — get file list
      const githubFileList =  await getRepoFiles(owner, name, branch);



// 3. for each file:
      for (const [fileIndex, file] of githubFileList.entries()){

//    a. call getFileContent(owner, name, filePath)
        const fileContent =await getFileContent(owner, name, file.path);
//    b. chunk content using LangChain TextSplitter
        const chunks = await splitter.splitText(fileContent);
//    c. embed chunks using Cohere
        const vectors = await embeddings.embedDocuments(chunks);
//    d. store in Redis with key: repoChunk:{userId}:{repoId}:{fileIndex}:{chunkIndex}
         const pipeline = client.pipeline();

      for(let i=0;i<chunks.length;i++){

        const key = `repoChunk:${userId}:${repoId}:${fileIndex}:${i}`;

        const value = JSON.stringify({
          text: chunks[i],
          embedding: vectors[i],
          filePath: file.path,
          repoId,
          userId
        });

        pipeline.set(key, value);
        }

      await pipeline.exec();
//    e. save RepoFile to MongoDB
        await RepoFile.create({
          // //     repoId:{type:mongoose.Schema.Types.ObjectId , ref:'GithubRepo' , required:true},
          //     userId:{type:mongoose.Schema.Types.ObjectId , ref:'User' , required:true},
          //     filePath:{type:String },
          //     language:{type:String},
          //     chunkCount:{type:Number},
          //     status:{type:String , enum:["pending" , "completed" , "failed"]}

          repoId , userId , filePath:file.path , chunkCount:chunks.length  , status:"completed"
        })


        
      }

        // step 7 — update status to "completed"
      currRepo.status="ready";
      currRepo.fileCount=githubFileList.length ;
      await currRepo.save();

    }catch(err){
      throw new Error(`Error in Github Worker with ${err}`)

    }

},
{
    connection,
  }
)

worker.on("completed", (job) => console.log(`Repo job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`Repo job ${job.id} failed:`, err));

export default worker;

