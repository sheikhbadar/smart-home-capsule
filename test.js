require('dotenv').config();
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Device = require('./models/Device');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Create a test token
const testToken = jwt.sign(
    { id: '1' }, // Using ID 1 from our users.json
    JWT_SECRET,
    { expiresIn: '1h' }
);

console.log('Test token created:', testToken);

// Socket.IO client configuration
const socket = io(SERVER_URL, {
    auth: {
        token: testToken
    },
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 5000
});

// Connection event handlers
socket.on('connect', () => {
    console.log('Socket connected successfully');
});

socket.on('authenticated', (data) => {
    console.log('Authentication successful:', data);
    
    // Request initial device state
    console.log('Requesting initial device state...');
    socket.emit('requestInitialState');
});

socket.on('deviceStates', (devices) => {
    console.log('Received device states:', JSON.stringify(devices, null, 2));
    
    // Test device toggle
    if (devices.lights && devices.lights.length > 0) {
        const testDevice = devices.lights[0];
        console.log('Testing device toggle for:', testDevice.id);
        socket.emit('toggleDevice', testDevice.id);
    }
});

socket.on('deviceStateChanged', (data) => {
    console.log('Device state changed:', data);
    
    // Test device settings update
    if (data.deviceId) {
        console.log('Testing device settings update...');
        socket.emit('updateDeviceSettings', {
            deviceId: data.deviceId,
            settings: {
                brightness: 75
            }
        });
    }
});

socket.on('deviceSettingsChanged', (data) => {
    console.log('Device settings updated:', data);
    console.log('All tests completed successfully');
    
    // Clean up and exit
    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 1000);
});

// Error handling
socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
});

socket.on('error', (error) => {
    console.error('Socket error:', error.message);
});

socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
});

// Set a timeout to exit if tests don't complete
setTimeout(() => {
    console.error('Test timeout - exiting');
    process.exit(1);
}, 10000); 