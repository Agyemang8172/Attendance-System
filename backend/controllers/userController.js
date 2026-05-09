const User = require('../models/User')
const bcrypt = require('bcrypt')


  exports.getAllUsers = async (req,res) => {
    const page =  parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page-1) * limit;

    try {
       const Users = await User.find({ isActive : true}).select('-password').sort({createdAt : -1}).skip(skip).limit(limit)

       const totalUser = await User.countDocuments({ isActive : true})
       const totalPages = Math.ceil(totalUser/limit);

       res.status(200).json({   
          success : true,
          data : Users,
          pagination : {
            currentPage : page,
            totalPages: totalPages,
            totalUsers : totalUser
          }
       })
       
    } catch(error) {
        res.status(500).json({
            message : 'Error  fetching users', error: error.message

        })

    }
  }



 exports.getUserById = async (req,res) => {
    try{
             const userId = req.params.id

             const user = await User.findById(userId).select('-password')

             if (!user) {
                return res.status(404).send('User not found')
             }
             res.status(200).json(user)
    } catch(error) {
        res.status(500).send('Server Error',error)
      }

}

exports.createUser = async (req,res)  => {
    try {
       
       const newUser =  new User(req.body)
          await newUser.save()

          const userObject = newUser.toObject()
          delete userObject.password

         res.status(201).json(
            { success : true,
               data : userObject
            }
         )
         }   catch(error)  {
            res.status(500).json({message : 'server Error',error : error.message})

         }
}


exports.updateUser = async (req,res) =>
  {
   try {
      const userId = req.params.id
      const updates = req.body


      delete updates.employeeID
      delete updates.password


      const updateUser = await 
      User.findByIdAndUpdate(
         userId,
         updates, {
            new : true,
            runValidators : true 
         }
      ).select('-password')

          if (!updateUser)    {
            return res.status(404).json({ message : 'User not found!'})
          }

          res.status(200).json({
            success : true, data : updateUser
          })
   }  catch (error)   {
        res.status(500).json({ message : 'update failed', error : error.message})
   }

      

}

  
  exports.deleteUser = async (req,res)  => {
   try {
           const userId = req.params.id
           const user = await User.findById(userId)

        if (!user)  {
         return res.status(404).json({
            success : false,
            message : 'User not found'
         })
        }

        if (!user.isActive)  {

          return res.status(400).json({
            success : false,
            message : 'User already deactivated'
         })
        }

         user.isActive = false
         await user.save()
            
         res.status(200).json({
            success: true,
            message : 'User deactivated successfully'
         })
   }   catch(error)  {
      res.status(500).json({message : 'delete Failed', error: error.message})
   }
  }


  exports.changePassword = async (req,res) => {
    try { 
       const {currentPassword, newPassword} = req.body 


       if (!currentPassword || !newPassword) {
         return res.status(400).json({
           success : false,
           message : 'Current password and new password are required'
         })
        }

       const userId = req.user.userId
       const user = await User.findById(userId)

       
       const isPasswordValid = await bcrypt.compare(currentPassword,user.password)

        if (!isPasswordValid){
            return res.status(401).json({
               success : false,
               message : 'Invalid current password'
            })

        }

        user.password =  await bcrypt.hash(newPassword,10)
        await user.save()
        return res.status(200).json({
         success : true,
         message:'Password changed successfully'

        })
    }
    catch (error)
    {
      res.status(500).json({message : 'change Password Failed', error: error.message})
    }
  }      