//import collection model 
import Collection from "../model/collection.model.js";


// createCollection -- to create a new collection 

export const createCollection = async(req,res) =>{

    try{

          //steps:
    //1 . get name and description from req body 
    const {name , description} = req.body;
    if(!name || !description){
        return res.status(400).json({'message':"Not enough info provided"});
    }
    //2 . get the userid 
    const userId = req.user.id;
    if(!userId){
        return res.status(400).json({'message':"Not authorized"});
    }
    //3. save to mongodb database
    const newCollection = await Collection.create({
        userId,
        name ,
        description
    })

    return res.status(200).json({
        'message':"Collection created successfully",
        'Collection':newCollection
    })
    //4. return the created collection 

    }catch(err){
        return res.status(500).json({'Error':err});
    }

  
}


export const getCollection = async(req,res) => {

    try{

        // steps:
        //1. get userId from the req.user.id 
        const userId = req.user.id;

        //2. get all the collection for the userId
        const collections =await  Collection.find({userId});

        if(!collections){
            return res.status(500).json({'message':"No collection Found in DB"})
        }
        //3. return the list of the collections
        return res.status(200).json({'collections':collections});

    }catch(err){
        return res.status(500).json({'Errror':err});

    }
}

export const deleteCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    const deleted = await Collection.findOneAndDelete({ _id: id, userId });

    if (!deleted) return res.status(404).json({ message: "Collection not found" });

    return res.status(200).json({ message: "Collection deleted successfully" });
  } catch(err) {
    return res.status(500).json({ error: err });
  }
}

