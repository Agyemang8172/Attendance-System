const jwt = require('jsonwebtoken')



const authmiddleware = (req,res,next)  => {
    const authHeader  = req.headers.authorization
 const token = authHeader &&  authHeader.split(' ')[1]

    if (!token)  {
        return  res.status(401).json({
    message : 'Access Denied. No token  Provided '
        })  
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()

    } 
    catch(error)  {
        return res.status(401).json({
            message : 'Invalid token'
        })
    }
}

module.exports = authmiddleware