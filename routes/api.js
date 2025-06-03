const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Device = require('../models/Device');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication Routes
router.post('/auth/signup', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        const token = jwt.sign({ _id: user._id }, JWT_SECRET);
        res.status(201).json({ user, token });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await user.comparePassword(password))) {
            throw new Error('Invalid login credentials');
        }

        const token = jwt.sign({ _id: user._id }, JWT_SECRET);
        res.json({ user, token });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Device Routes
router.get('/devices', auth, async (req, res) => {
    try {
        const devices = await Device.find({ owner: req.user._id });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/devices', auth, async (req, res) => {
    try {
        const device = new Device({
            ...req.body,
            owner: req.user._id
        });
        await device.save();
        res.status(201).json(device);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.patch('/devices/:id', auth, async (req, res) => {
    try {
        const device = await Device.findOne({ 
            _id: req.params.id,
            owner: req.user._id
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        Object.assign(device, req.body);
        await device.save();
        res.json(device);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/devices/:id', auth, async (req, res) => {
    try {
        const device = await Device.findOneAndDelete({
            _id: req.params.id,
            owner: req.user._id
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json(device);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Energy Usage Routes
router.get('/devices/:id/energy', auth, async (req, res) => {
    try {
        const device = await Device.findOne({
            _id: req.params.id,
            owner: req.user._id
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json(device.energyUsage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Settings Routes
router.patch('/settings', auth, async (req, res) => {
    try {
        const user = req.user;
        user.settings = { ...user.settings, ...req.body };
        await user.save();
        res.json(user.settings);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 