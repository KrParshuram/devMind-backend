import mongoose from 'mongoose';

const RepoSchema = new mongoose.Schema({
    userId: {type:mongoose.Schema.Types.ObjectId , ref:'User' , required:true},
    repoUrl:{type:String },
    owner:{type:String},
    name:{type:String},
    branch:{type:String},
    status:{type:String  , enum:["pending", "indexing", "ready", "failed"]},
    fileCount:{type:Number},
    indexedAt:{type:Date },
    createdAt:{type:Date , default:Date.now}
})

const GithubRepo = mongoose.model("GithubRepo" , RepoSchema);
export default GithubRepo;