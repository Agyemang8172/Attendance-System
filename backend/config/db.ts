
import mongoose from 'mongoose';


const connectDB = async () => {
    try {
        const dbURI = process.env.MONGODB_URI


            if (!dbURI) {
            throw new Error('MONGODB_URI is not defined');
            }
        console.log('Attempting to connect to:', dbURI.replace(/:[^:]*@/, ':****@'));
        
        const conn = await mongoose.connect(dbURI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
       
       
        
    } catch (error) {
         if (error instanceof Error) {
        console.log(`Error: ${error.message}`);
    }
    
    }
};

 export default connectDB