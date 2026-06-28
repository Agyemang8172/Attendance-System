const User = require('../models/User')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')


exports.login = async (req,res)  => {
   try {
      const {email, password} = req.body


      if (!email || !password) {
         return res.status(400).json({
            success:false,
            message: 'Email and Password required'
         })
      }

    const user = await User.findOne({email})

      if (!user )  {
           return  res.status(404).json({
                 success : false,
                 message : 'User not found'
           })

      }

      if (!user.isActive)  {
        return res.status(403).json({
            success : false,
            message : 'Account deactivated'
        })
      }
     const isPasswordValid = await bcrypt.compare(password,user.password)

     if (!isPasswordValid) {
        return res.status(401).json({
            success: false,
            message:  'Invalid Password'
        })
     }

 const token = jwt.sign(
              {userId : user._id, role: user.role},
              process.env.JWT_SECRET,
              {expiresIn: '24h'}
       )

      res.status(200).json({
    success:true,
    token: token,
     user : {
        id : user._id,
        email:user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role : user.role,
        mustChangePassword: user.mustChangePassword
     }
  })
         

   }   
   catch (error)  {
      res.status(500).json({
        message : 'Login failed',
        error : error.message
      })
   }  

}