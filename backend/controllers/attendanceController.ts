
import { request } from 'node:http'
import Attendance from '../models/attendance'
import {Request, Response} from 'express'


export const clockIn=  async (
    req:Request,
    res:Response)  => {
  try {

     if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    const userId = req.user.userId

      const openSession = await Attendance.findOne({
        
           userId: userId, 
           checkOutTime: null        
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
      if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      })
    }
  }
}

export const clockOut = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    const userId = req.user.userId
    const clockOut = new Date()

    const openSession = await Attendance.findOne({
      user: userId,
      sessionStatus: 'open'
    })

    if (!openSession) {
      return res.status(404).json({
        success: false,
        message: 'You will have to have an active session open'
      })
    }

    const hoursWorked =
      (clockOut.getTime() - openSession.clockIn.getTime()) /
      (1000 * 60 * 60)

    const updatedRecord = await Attendance.findOneAndUpdate(
      {
        user: userId,
        sessionStatus: 'open'
      },
      {
        clockOut,
        sessionStatus: 'closed',
        hoursWorked
      },
      {
        new: true
      }
    )

    return res.status(200).json({
      success: true,
      message: 'clock Out successful',
      data: updatedRecord
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      })
    }
  }
}




export const getMyAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    const { startDate, endDate } = req.query

    const records = await Attendance.find({
      user: req.user.userId,
      ...(startDate &&
        endDate && {
          clockIn: {
            $gte: new Date(startDate as string),
            $lte: new Date(endDate as string)
          }
        })
    }).sort({ clockIn: -1 })

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attendance records found'
      })
    }

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: 'server error',
        error: error.message
      })
    }
  }
}


export const getAllAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    const { startDate, endDate } = req.query

    const records = await Attendance.find({
      ...(startDate &&
        endDate && {
          clockIn: {
            $gte: new Date(startDate as string),
            $lte: new Date(endDate as string)
          }
        })
    })
      .populate(
        'user',
        'firstName lastName employeeID department role'
      )
      .sort({ clockIn: -1 })

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attendance records found'
      })
    }

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records
    })
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: 'server error',
        error: error.message
      })
    }
  }
}