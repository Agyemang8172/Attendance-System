const mongoose = require('mongoose')


const attendanceSchema = new mongoose.Schema({

   user : {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
   },

     
     clockIn : {
      type: Date,
      required:true
     
     },

     clockOut : {
        type: Date,
    
       
     },

    date : {
        type : Date,
        required:true
    },
    status: {
        type:String,
        enum: ['present','late','absent'],
        default: 'present'
    },

    notes :{
        type: String
    }


   

},
    {
        timestamps: true
    }

    
);

module.exports = mongoose.model('Attendance',attendanceSchema)