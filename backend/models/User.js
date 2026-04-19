const mongoose = require('mongoose')
const bcrypt = require('bcrypt')


const userSchema = new mongoose.Schema({

       employeeID: {
         type: String   ,
          unique: true,
          required:true
       },

      firstName : {
        type:String,
        required: true,

      },
      lastName : {
        type:String, 
        required:true

      },  

      email : {
        type:String,
        required:true,
        unique: true
      },
      password : {
        type: String,
        required: true,
     

      },


      department : {
        type:String,
        required:true
     },

      isActive : {
           type: Boolean,
           default: true
      },

      role : {
        type: String,
        enum : ['staff','hr','superadmin'],
        default : 'staff'
      }
    },
 
       {     
          timestamps:true
          })


    userSchema.pre('save', async function() {

      if (!this.isModified('password')) {
        return ;
      }

      this.password = await bcrypt.hash(this.password, 10)
      
    })


module.exports = mongoose.model('User',userSchema)