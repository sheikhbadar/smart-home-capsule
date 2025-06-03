require('dotenv').config();
const mongoose = require('mongoose');

console.log('Attempting to connect to MongoDB...');
console.log('Connection string:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'smarthome',  // Explicitly specify database name
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
})
.then(() => {
    console.log('Successfully connected to MongoDB!');
    console.log('Connected to database:', mongoose.connection.db.databaseName);
    process.exit(0);
})
.catch(err => {
    console.error('Connection error:', err.message);
    if (err.code) console.error('Error code:', err.code);
    if (err.codeName) console.error('Code name:', err.codeName);
    process.exit(1);
}); 