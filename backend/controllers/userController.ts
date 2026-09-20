import User from '../models/User'
import bcrypt from 'bcrypt'
import { Request, Response } from 'express'



// ── Account-creation helpers ─────────────────────────────────────────────────


// It's single-use — the user is forced to change it on first login — so this
// modest strength is fine for a short-lived credential.
const ADJECTIVES = ['amber','brave','calm','clever','swift','bright','bold','lucky','quiet','sunny','royal','noble','keen','warm','cool','eager','gentle','jolly','merry','witty','zesty','prime','vivid','crisp','snug','plucky','dapper','breezy','mellow','rapid']
const NOUNS = ['tiger','river','falcon','maple','cedar','otter','comet','harbor','meadow','willow','ember','pebble','lantern','summit','breeze','canyon','beacon','garnet','quartz','sparrow','badger','marlin','cobra','walrus','pelican','heron','jaguar','panther','dolphin','raven']

const generateTempPassword = () => {
  const pick = (arr:string[]) =>
     arr[Math.floor(Math.random() * arr.length)]
  const digits = Math.floor(1000 + Math.random() * 9000) // 1000–9999
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${digits}`
}

// Next employee ID like EMP-0001. Reads the current highest EMP-#### and adds 1.
// Zero-padding to 4 digits keeps string order the same as numeric order.
const generateEmployeeID = async () => {
  const last = await User.findOne({ employeeID: /^EMP-\d+$/ })
    .sort({ employeeID: -1 })
    .select('employeeID')

  let next = 1
  if (last?.employeeID) {
    const n = parseInt(last.employeeID.split('-')[1], 10)
    if (!Number.isNaN(n)) next = n + 1
  }
  return `EMP-${String(next).padStart(4, '0')}`
}



  export const getAllUsers = async (
    req: Request,
    res: Response) => {
    const page =  parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
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
       if ( error instanceof Error)  {
        res.status(500).json({
            message : 'Error  fetching users', 
            error: error.message
          })
        }
        }
      }
      

    
  


 export const getUserById = async (
  req: Request,
  res: Response
) => {
    try{
             const userId = req.params.id

             const user = await User.findById(userId).select('-password')

             if (!user) {
                return res.status(404).send('User not found')
             }
             res.status(200).json(user)
    } catch (error) {
  if (error instanceof Error) {
    res.status(500).json({
      message: 'Server Error',
      error: error.message
    })
  }
}
}

export const createUser = async (
req: Request, 
res: Response) => {
  try {
    const { firstName, lastName, email, department, role } = req.body

    if (!firstName || !lastName || !email || !department) {
      return res.status(400).json({
        success: false,
        message: 'firstName, lastName, email and department are required.',
      })
    }

    const employeeID = await generateEmployeeID()
    const tempPassword = generateTempPassword()

    const newUser = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      department: department.trim(),
      role: role || 'staff',
      employeeID,
      password: tempPassword,        // hashed by your pre-save hook
      mustChangePassword: true,
    })

   await newUser.save()

const { password, ...userObject } = newUser.toObject()

res.status(201).json({
  success: true,
  data: userObject,
  tempPassword,
})
  } catch (error) {
  if (error instanceof Error) {
    const err = error as Error & { code?: number }
    if (err.code === 11000) {
      return res.status(409).json({
        success: false, 
        message: 'That email is already taken.'
      })
    }


    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    })
  }
}
}

export const updateUser = async (
req: Request, 
res: Response) =>
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
   }  catch (error) { 
    if (error instanceof Error) {
       {
        res.status(500).json
        ({ message : 'update failed',
         error : error.message})
       
     }
  }
}}

  
  export const deleteUser = async (
    req: Request, 
    res: Response)  => {
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
   }   catch (error) {
  if (error instanceof Error) {
    res.status(500).json({
      message: 'delete failed',
      error: error.message
    })
  }
}
  }


  export const changePassword = async (
    req: Request, 
   res: Response
  ) => {
    try { 
       const {currentPassword, newPassword} = req.body 


       if (!currentPassword || !newPassword) {
         return res.status(400).json({
           success : false,
           message : 'Current password and new password are required'
         })
        }
            if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

       const userId = req.user.userId
       const user = await User.findById(userId)

              if (!user) {
                  return res.status(404).json({
                    success: false,
                    message: 'User not found'
                  })
        }

        
       const isPasswordValid = await bcrypt.compare(currentPassword,user.password)

        if (!isPasswordValid){
            return res.status(401).json({
               success : false,
               message : 'Invalid current password'
            })

        }

        user.password = newPassword
        user.mustChangePassword = false
        await user.save()
        return res.status(200).json({
         success : true,
         message:'Password changed successfully'

                  })
              }
              catch (error) {
            if (error instanceof Error) {
              res.status(500).json({
                message: 'Change password failed',
                error: error.message
              })
            }
          }
          }


          export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword
}