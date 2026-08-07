import * as z from "zod";
import User from "../model/users.model.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const signupSchema = z.object({
    name: z.string().min(3),
    email:z.string().email(),
    password:z.string().min(6)

})

export const signup = async (req, res) =>{

    

    try{
            //logic here 
        //step1 . verify using zod 
        const userdata = signupSchema.safeParse(req.body);

        if(!userdata.success) {
            return res.status(400).json({error:userdata.error})
        }


        //step 2. destructure data (name , email , password from body )
        const {name , email , password} = req.body ;


        //step 3. check in db that  user exists already -- 

        let existingUser;
        existingUser= await User.findOne({email});
        if(existingUser){
            return res.status(400).json({message:"user is already signed-Up"});
        }

    
    
    // step 3.5 create hashed password for the user and store everything in db
    // pass -123456 -- dont store in db -- 
    const hash = await bcrypt.hash(password , 10);

    const newUser= await User.create({ name, email, password: hash })



    // step 4. create jwt token for the user 
    
    const secretKey = process.env.JWT_SECRET;
    const token = jwt.sign({id: newUser._id, email: newUser.email}, secretKey, { expiresIn: '1h' });

    //step 5 . return success with token
     
    return res.status(200).json({
    success: true,
    user: { name:newUser.name, email:newUser.email},
    token:token
    });
    }catch(err){
        console.log("some error in sign up "+ err);
        return res.status(400).json({error:err});
    }
   
    

}

export const login = async (req,res) =>{

    //logic here 
    //stepsZod validation
    // Find user by email — if not found, return 404
    // Compare password with bcrypt
    // Generate JWT
    // Return token

    //zod validation 

    try{
    const userdata = loginSchema.safeParse(req.body);
    if(!userdata.success) return res.status(400).json({error:userdata.error});

    const {email , password} = req.body;

    //Find user by email — if not found, return 404
    const user = await User.findOne({email});
    if(!user) return res.status(404).json({message:"User not found"})

    //Compare password with bcrypt
    const isMatch =await bcrypt.compare(password , user.password);

    if(!isMatch) return res.status(401).json({message: "wrong password"});

    //// Generate JWT
    const secretkey = process.env.JWT_SECRET;
    const token = jwt.sign({id:user._id , email:user.email} , secretkey ,{ expiresIn: '1h' });

    return res.status(200).json({
        name:user.name , 
        email:user.email ,
        token:token
    })
}catch(err){
    console.log("some error during thee sign in");
    res.status(400).json({error :err});
}

}


