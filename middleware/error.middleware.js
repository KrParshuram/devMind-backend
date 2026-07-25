//global error handler --

export const errorhandler = (err , req , res , next) =>{
    const status = err.status || 500;
    const message = err.message || "Something Went Wrong";

    return res.status(status).json({success:false , message});

}

