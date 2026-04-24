

const authorizeRole = (...allowedRoles)  => {

    return (req,res,next)  => {

    if(!req.user || !req.user.role) 
            return res.status(401).json({
        message: 'The user does not exist, Pls log in'})


     if (allowedRoles.includes(req.roles))
    }

    

}