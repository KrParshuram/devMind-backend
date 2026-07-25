import mongoose from "mongoose";

async function connectDB() {

    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log('connected to mongo db ..');
        
    }catch(err){
        console.log("Error connecting to mongo db: "+err);
        process.exit(1);
    }
}

export default connectDB;