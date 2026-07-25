// Resource:
// {
//   userId: ObjectId,
//   type: "url" | "text" | "code" | "file",
//   title: String,
//   content: String,        // raw content
//   sourceUrl: String,      // if type is url
//   filePath: String,       // if type is file
//   tags: [String],
//   collectionId: ObjectId, // optional
//   status: "pending" | "processing" | "completed" | "failed",
//   chunkCount: Number,     // how many chunks were created
//   createdAt: Date
// }
import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema({
    userId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true} ,
    type: {type:String , required:true ,enum:["url" , "text" , "code" , "file"]},
    title:{type:String , required:true} ,
    content:{type:String} ,
    sourceUrl:{type:String},
    filePath:{type:String},
    tags:[{type:String, trim:true}],
    collectionId: {type: mongoose.Schema.Types.ObjectId, ref: 'Collection'} , // no required
    status:{type:String , enum:["pending" , "processing", "completed" , "failed"]},
    chunkCount:{type:Number },
    createdAt:{type:Date , required:true , default:Date.now}
})

const Resource = mongoose.model("Resource" ,resourceSchema )

export default Resource;