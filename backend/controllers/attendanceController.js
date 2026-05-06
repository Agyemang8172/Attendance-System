
const Attendance = require('../models/attendance')


exports.clockIn=  async (req,res)  => {
  try {
    const userId = req.user.userId
      const openSession = await Attendance.findOne({
         user: userId, 
         sessionStatus: 'open'
         })

        if(openSession)  {
            return res.status(400).json({
            success : false,
            message : 'You already have an active session open. Clock out first'
            })
        }

        const today = new Date()
        today.setHours(0,0,0,0)

        const newRecord = await Attendance.create({
            user : userId,
             clockIn : new Date(),
            sessionStatus : 'open',
            date : today
        })

         return  res.status(201).json({
            success: true,
            message: 'clock in successful',
            data: newRecord  
        })

  }
  catch(error) {
      res.status(500).json({ message: "Server error", error: error.message });
  }


}


exports.clockOut = async (req,res)  => {

    try {
     const userId = req.user.userId
     
        const clockOut = new Date()


         const openSession = await Attendance.findOne({
        user : userId,
        sessionStatus : 'open'
     })

      if(!openSession) {
            return res.status(404).json({
                success : false,
            message : 'You will have to have an  active session open'
            })
            }

        
   

     const hoursWorked =  (clockOut - openSession.clockIn) / (1000 * 60 * 60)





          const updatedRecord = await Attendance.findOneAndUpdate({
        user : userId,
        sessionStatus : 'open'
     },

    {
        clockOut: clockOut,
        sessionStatus: 'closed',
        hoursWorked: hoursWorked
        },
    {
    new : true
    })


       return  res.status(200).json({
            success: true,
            message: 'clock Out successful',
            data: updatedRecord
        })
    } 

    catch (err)  {
        res.status(500).json({ message: "Server error", error: err.message });
 }

} 



exports.getMyAttendance =  async (req,res)  => {
    try {
        const {startDate,endDate}  = req.query
    const records =   await Attendance.find({
        user : req.user.userId,
        ...(startDate && endDate &&  {
              clockIn : { 
              $gte : new Date(startDate),
             $lte : new Date(endDate)
            }
         })
    }).sort({ clockIn : -1})

    if (records.length === 0)  {
        return res.status(404).json({
            success :false,
            message:'No attendance records found'
        })
    }

    res.status(200).json({
        success: true,
        count : records.length,
        data : records

        
         })

    } catch (error)  {
        res.status(500).json({
            success : false,
            message : 'server error',
            error : error.message
        })

    }

}
exports.getAllAttendance = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const records = await Attendance.find({
            ...(startDate && endDate && {
                clockIn: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            })
        }).sort({ clockIn: -1 });

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No attendance records found'
            });
        }

        res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'server error',
            error: error.message
        });
    }
};