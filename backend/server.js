const express = require('express');
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config();
const connectDB = require('./config/db')
const app = express();
const PORT = process.env.PORT || 8000;
const userRoutes = require('./routes/userRoutes')
const authRoutes = require('./routes/authRoutes')
const attendanceRoutes =require('./routes/attendanceRoutes')





app.use(express.json())
app.use(cors({
    origin:'http://localhost:5173',
    credentials: true
}))


app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/attendance', attendanceRoutes)




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
