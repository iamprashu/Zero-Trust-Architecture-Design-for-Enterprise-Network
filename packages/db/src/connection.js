const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "dd";
    console.log(mongoUri);
    if (!mongoUri) {
      console.error('MONGO_URI is not defined in the environment variables');
      // For libraries, better to throw instead of process.exit
      throw new Error('MONGO_URI is missing');
    }

    // Connect without deprecated options in Mongoose 8
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = { connectDB };
