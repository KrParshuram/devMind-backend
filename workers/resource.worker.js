import { Worker } from "bullmq";
import Resource from "../model/resources.model.js";
import client from "../config/redis.js";  // ← add this
import axios from "axios";
import * as cheerio from "cheerio";
// import * as pdf from "pdf-parse";
import fs from "fs";
import chunkText from "../services/chunk.service.js"
import embedChunks from "../services/embed.service.js" 
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3.js";
// import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { PDFParse } from 'pdf-parse';

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}
};

const worker = new Worker("Resources", async (job) => {
  
  const { resourceId, userId } = job.data;
  try{
  console.log(`Processing job ${job.id} for resource ${resourceId}`);

  // step 1 — fetch resource from MongoDB
  const resource = await Resource.findOne({userId:userId , _id:resourceId});
  if (!resource) {
    throw new Error("Resource not found");
}

  // step 2 — update status to "processing"
  await Resource.updateOne(
    {userId:userId , _id:resourceId} ,
    {$set: {status:"processing"}}
  );
  // step 3 — extract content based on type

  let content;
  if(resource.type == "text" || resource.type == "code"){
    content = resource.content;
  } else if(resource.type == "url"){

    //scrape with axios and cheerio
    // fetch page → load into cheerio → extract text from p, h1, h2, article tags
    const response = await axios.get(resource.sourceUrl);
    const $ = cheerio.load(response.data);
    content = $("p, h1, h2, h3, article").text();
  }else if(resource.type == "file"){
  // extract key from S3 URL
  const url = new URL(resource.filePath);
  const key = url.pathname.slice(1); // removes leading /

  // download from S3
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key
  });

  const s3Response = await s3.send(command);
  
  // convert stream to buffer
  const chunks = [];
  for await (const chunk of s3Response.Body) {
    chunks.push(chunk);
  }
  const dataBuffer = Buffer.concat(chunks);

  const uint8Array = new Uint8Array(dataBuffer);

  // parse PDF
  const pdfDataParser = new PDFParse(uint8Array);
  const pdfData = await pdfDataParser.getText();
  content = pdfData.text;
  }
  // step 4 — chunk content

  const chunks = chunkText(content);



  // step 5 — embed chunks
  const embeddings = await embedChunks(chunks);

  //chunks = text ---> array / vector of numbers --


  // step 6 — store in Redis


  const pipeline = client.pipeline();

  for(let i=0;i<chunks.length;i++){

    const key = `chunk:${userId}:${resourceId}:${i}`;

    const value = JSON.stringify({
        text:chunks[i] ,
        embeddings:embeddings[i],
        resourceId ,
        userId,
        title:resource.title
    });

    pipeline.set(key, value);
  }

  await pipeline.exec();
  // step 7 — update status to "completed"

    await Resource.updateOne(
    { _id: resourceId, userId: userId },
    { $set: { status: "completed", chunkCount: chunks.length } }
    );

  }catch(err){
   await Resource.updateOne(
    { _id: resourceId, userId },
    {
        $set: {
            status: "failed",
            error: err.message
        }
    }
);

throw err;
  }


}, { connection });

worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`Job ${job.id} failed:`, err));

export default worker;

// Job starts
//       ↓
// status = processing
//       ↓
// Processing...
//       ↓
// Success?
//    ↙        ↘
// Yes         No
//  ↓           ↓
// completed   failed
//              ↓
//       save error message
//              ↓
//         throw error


// PIPELINE --- storing each embedding with a await -- 
// will take so much time so we are using the pipeline , 
// pipeline is like a empty list , we add all the key , 
// value pair to the pipeline without using await -- 
// then using the pipeline to add all task using a single await line --
//  this will make redis write faster by almost 100 to 500 times faster