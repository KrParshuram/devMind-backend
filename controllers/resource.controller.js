import Resource from "../model/resources.model.js";
import Resourcequeue from "../queues/resource.queue.js";

async function addToqueue(resourceId , userId){

    try{
        const job = await Resourcequeue.add('process-resource' , {
            resourceId :resourceId ,
            userId:userId
        });

        console.log(`Job added Successfully with JOB ID : ${job.id}`);
        
    }catch(error){
        console.error("Failed to add job to queue:", error);
    }
}

export const createResource = async (req,res) =>{

    //get resource details from the req body --
    // type: {type:String , required:true ,enum:["url" , "text" , "code" , "file"]},
    // title:{type:String , required:true} ,
    // content:{type:String} ,
    // sourceUrl:{type:String},
    // filePath:{type:String},
    // tags:[{type:String, trim:true}],

    try{

    const {type , title , content , sourceUrl , filePath , tags} = req.body;

    if (!type) {
        return res.status(400).json({
            message: "Resource type is required."
        });
    }

    if (type === "text" || type === "code") {
        if (!title || !content) {
            return res.status(400).json({
                message: "Title and content are required."
            });
        }
    } else if (type === "url") {
        if (!title || !sourceUrl) {
            return res.status(400).json({
                message: "Title and source URL are required."
            });
        }
    } else if (type === "file") {
        if (!title || !filePath) {
            return res.status(400).json({
                message: "Title and file path are required."
            });
        }
    } else {
        return res.status(400).json({
            message: "Invalid resource type."
        });
    }
    //get userId from the auth middleware 
    const userId = req.user.id;

    // save the resource into the mongodb 
    const newResource = await Resource.create({
        userId,
        type,
        title,
        content,
        sourceUrl,
        filePath,
        tags,
        status:"pending",
    })


    addToqueue(newResource._id ,userId );
    



    //return success
    res.status(200).json({
        message:"new resource created successfully",
        resource:newResource
    });
}catch(err){
    console.log(err);

    return res.status(500).json({
        message:"some error while creating the resource" ,
        error:err
    });
}
}

export const createFileResource = async (req, res) => {
  try {
    const userId = req.user.id;
    const title = req.body.title;
    const filePath = req.file.location;  // S3 URL from multer-s3

    const newResource = await Resource.create({
      userId,
      type: "file",
      title,
      filePath,
      status: "pending"
    });

    addToqueue(newResource._id, userId);

    return res.status(200).json({
      message: "File uploaded successfully",
      resource: newResource
    });
  } catch(err) {
    return res.status(500).json({ error: err });
  }
}

export const getResource = async(req, res) =>{

    // recieve request --
    try{

    //get userID from the body 
    const userId = req.user.id;

    //read page and limit 
    const page = parseInt(req.query.page ,10) || 1;
    const limit = parseInt(req.query.limit , 10) || 10;


    //calculate skip --
    const skip = (page -1)* limit ;

    //query mongodb --

    const data = await Resource.find({userId}).skip(skip).limit(limit).sort({ createdAt: -1 });

    //count total documents 
    const totalDocs = await Resource.countDocuments({userId});

    const totalPage = Math.ceil(totalDocs / limit);

    //return JSON

    return res.status(200).json({
        data :data ,
        totalDocument:totalDocs ,
        totalPage:totalPage 
    })

    }catch(err){
        return res.status(500).json({
            message:"some interal error while fetching resources" ,
            error:err
        });

    }
}


export const resource = async(req, res) =>{

    try{
    
    // read body 

    //get userId from the body 
    const userId = req.user.id;

    // get document id from the params 
    const id = req.params.id;

    // mongodb find 

    const data = await Resource.findOne({userId , _id:id});

    // if not found 
    if(!data){
        return res.status(404).json({message:"fetched document is not found.."});
    }
    // return if found 
    return res.status(200).json({
        data:data ,
        message:"fetched successfully"

    })

    
    } catch(err){
        console.log(err);
        return res.status(500).json({
            error:err
        });
    }


}

export const deleteResource = async (req, res) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    // 1. find and delete from MongoDB

    const deleted =await Resource.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ message: "Resource not found" });
    // 2. get all Redis keys for this resource
            // get all chunk keys for this resource
        const keys = await client.keys(`chunk:${userId}:${id}:*`);

        // delete all of them
        if (keys.length > 0) {
        await client.del(...keys);  // spread keys as arguments
        }

    // 4. return success
    return res.status(200).json({ message: "Resource deleted successfully" })
  } catch(err) {
    return res.status(500).json({ error: err });
  }
}
