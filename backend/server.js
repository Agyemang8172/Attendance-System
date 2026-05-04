const express = require('express');
const dotenv = require('dotenv')
dotenv.config();
const connectDB = require('./config/db')
const app = express();
const PORT = process.env.PORT || 8000;
const userRoutes = require('./routes/userRoutes')
const authRoutes = require('./routes/authRoutes')






app.use(express.json())

app.use('/api/users', userRoutes);
app.use('/api/users/id',userRoutes)
app.use('/api/auth', authRoutes)




const startServer = async ()  => {
    try{
        app.listen(PORT, () =>  {
            console.log(`Server is runnig on port ${PORT}`)
        })
    }  catch (error)  {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}


startServer()
