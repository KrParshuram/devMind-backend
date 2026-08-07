import jwt from "jsonwebtoken";

export const authMiddleware = (req , res , next) =>{

    try{
    //Get token from Authorization header (Bearer <token>)
    let token;
    const authHeader = req.headers["authorization"];
    if(authHeader && authHeader.startsWith('Bearer ')){
        token = authHeader.split(' ')[1];
    }
    // If no token — return 401
    if(!token){
        return res.status(401).json({message:"unauthorized"});
    }
    // Verify token using jwt.verify  //jason web token
    const decoded = jwt.verify(token , process.env.JWT_SECRET);

    // Attach decoded user to req.user
    if(!decoded) {
        return res.json({erro:"something problem with jwt verify"})
    }

    req.user = decoded;
    // Call next()
    next();
    }catch(err){
        console.log("JWT verification erro:" + err.message)
        return res.status(403).json({message: "invalid token"})

    }
}