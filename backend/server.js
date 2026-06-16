const express = require('express');
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config();
const connectDB = require('./config/db')
const app = express();
const PORT = process.env.PORT || 8000 
const userRoutes = require('./routes/userRoutes')
const authRoutes = require('./routes/authRoutes')
const attendanceRoutes =require('./routes/attendanceRoutes')





app.use(express.json())
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true)
    
    if (
      origin.endsWith('.vercel.app') ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:5174'
    ) {
      return callback(null, true)
    }
    
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))


app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/attendance', attendanceRoutes)


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})




const startServer = async ()  => {
    try{
        await connectDB()
        app.listen(PORT, () =>  {
        console.log(`Server is runnig on port ${PORT}`)
        })

    }  catch (error)  {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}


startServer()
