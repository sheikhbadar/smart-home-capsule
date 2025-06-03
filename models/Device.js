const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['light', 'climate', 'security']
    },
    state: {
        type: Boolean,
        default: false
    },
    settings: {
        brightness: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        },
        temperature: {
            type: Number,
            default: 22
        },
        targetTemperature: {
            type: Number,
            default: 22
        },
        mode: {
            type: String,
            enum: ['auto', 'eco', 'manual'],
            default: 'auto'
        },
        count: {
            type: Number,
            default: 1
        }
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    energyUsage: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        value: {
            type: Number,
            required: true
        }
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update lastUpdated timestamp before saving
deviceSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

module.exports = mongoose.model('Device', deviceSchema); 