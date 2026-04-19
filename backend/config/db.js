
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbURI = process.env.MONGODB_URI.trim();
        console.log('Attempting to connect to:', dbURI.replace(/:[^:]*@/, ':****@'));
        
        const conn = await mongoose.connect(dbURI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
       
        
       
        const testUser = await User.findOne();
       
        
    } catch (error) {
        console.log(`Error: ${error.message}`);
    
    }
};

module.exports = connectDB;