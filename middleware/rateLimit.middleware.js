import client from "../config/redis.js";


const rateLimit = ({ limit, window, prefix}) =>{


    return async (req, res, next)=>{

        try{
        const userId = req.user.id ;
        const key =  `rate:${prefix}:${userId}`;
        const count = await client.incr(key);

        if(count===1){
                await client.expire(key , window);
        }

        if (count > limit) {
             return res.status(429).json({
            success: false,
            message: "Rate limit exceeded. Please try again later."
         });
        }

        
        next();

        }catch(err){
             next(err);
        }




    }
}

export default rateLimit;