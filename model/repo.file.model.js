// RepoFile {
//   repoId: ObjectId,
//   userId: ObjectId,
//   filePath: String,
//   language: String,
//   chunkCount: Number,
//   status: "pending" | "completed" | "failed"
// }

import mongoose from 'mongoose';

const RepoFileSchema = new mongoose.Schema ({
    repoId:{type:mongoose.Schema.Types.ObjectId , ref:'GithubRepo' , required:true},
    userId:{type:mongoose.Schema.Types.ObjectId , ref:'User' , required:true},
    filePath:{type:String },
    language:{type:String},
    chunkCount:{type:Number},
    status:{type:String , enum:["pending" , "completed" , "failed"]}
})

const RepoFile = mongoose.model("RepoFile", RepoFileSchema);  

export default RepoFile;