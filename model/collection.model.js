// Collection {
//   userId: ObjectId,
//   name: String,
//   description: String,
//   createdAt: Date
// }

import mongoose from "mongoose";

const collections = new mongoose.Schema({
    userId: {type:mongoose.Schema.Types.ObjectId , ref:'User' ,required:true} ,
    name:{type:String },
    description:{type:String },
    createdAt:{type:Date , required:true , default:Date.now}
})

const Collection = mongoose.model("Collection" ,collections );

export default Collection;