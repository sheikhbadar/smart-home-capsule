require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { 
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});
const jwt = require('jsonwebtoken');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Load users from JSON file
let users = [];
try {
    const userData = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
    users = JSON.parse(userData).users;
} catch (error) {
    console.error('Error loading users:', error);
    users = [];
}

// Save users to JSON file
function saveUsers() {
    try {
        fs.writeFileSync(
            path.join(__dirname, 'users.json'),
            JSON.stringify({ users }, null, 2),
            'utf8'
        );
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (users.some(u => u.email === email)) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: String(users.length + 1),
            name,
            email,
            password: hashedPassword
        };

        users.push(newUser);
        saveUsers();

        const token = jwt.sign(
            { id: newUser.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        res.status(201).json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// API endpoint for initial state
app.get('/api/state', (req, res) => {
    res.json(state);
});

// In-memory state management
const state = {
    devices: {
        livingRoomLights: { 
            on: false, 
            brightness: 100,
            count: 4,
            name: 'Living Room Lights'
        },
        kitchenLights: { 
            on: false, 
            brightness: 100,
            count: 2,
            name: 'Kitchen Lights'
        },
        thermostat: {
            on: true,
            target: 72,
            current: 72,
            humidity: 45,
            ecoMode: true,
            name: 'Main Thermostat'
        }
    },
    environment: {
        temperature: 72,
        humidity: 45,
        energy: {
            current: 0,
            daily: 0,
            monthly: 0,
            history: [],
            costs: {
                hourly: 0,
                daily: 0,
                monthly: 0,
                savings: 0
            }
        },
        weather: 'sunny'
    },
    system: {
        homeAway: 'home',
        armed: false
    }
};

// Calculate energy usage based on device states
function calculateEnergyUsage() {
    let totalUsage = 0;
    
    // Calculate light energy usage (60W per bulb at full brightness)
    if (state.devices.livingRoomLights.on) {
        totalUsage += (state.devices.livingRoomLights.brightness / 100) * 60 * state.devices.livingRoomLights.count;
    }
    if (state.devices.kitchenLights.on) {
        totalUsage += (state.devices.kitchenLights.brightness / 100) * 60 * state.devices.kitchenLights.count;
    }
    
    // Calculate thermostat energy usage (100W per degree difference from target)
    if (state.devices.thermostat.on) {
        const tempDiff = Math.abs(state.devices.thermostat.current - state.devices.thermostat.target);
        totalUsage += tempDiff * 100;
    }
    
    return totalUsage;
}

// Calculate maximum possible energy usage
function calculateMaxPossibleUsage() {
    let maxUsage = 0;
    
    // Max light usage (all lights at full brightness)
    maxUsage += state.devices.livingRoomLights.count * 60; // 60W per bulb
    maxUsage += state.devices.kitchenLights.count * 60;
    
    // Max thermostat usage (assuming max 5°F difference)
    maxUsage += 5 * 100; // 100W per degree difference
    
    return maxUsage;
}

// Calculate costs based on energy usage
function calculateCosts(currentUsage) {
    const ratePerKwh = 0.12; // $0.12 per kWh
    const kWh = currentUsage / 1000;
    
    // Calculate hourly cost
    const hourlyCost = kWh * ratePerKwh;
    
    // Calculate daily and monthly projections
    const dailyCost = hourlyCost * 24;
    const monthlyCost = dailyCost * 30;
    
    // Calculate potential savings
    const maxUsage = calculateMaxPossibleUsage();
    const maxHourlyCost = (maxUsage / 1000) * ratePerKwh;
    const savings = maxHourlyCost - hourlyCost;
    
    return {
        hourly: hourlyCost,
        daily: dailyCost,
        monthly: monthlyCost,
        savings: savings
    };
}

// Update nested state path
function updateStatePath(path, data) {
    const parts = path.split('.');
    let current = state;
    
    // Navigate to the nested location
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            console.error('Invalid path:', path);
            return null;
        }
        current = current[parts[i]];
    }
    
    // Update the final property
    const finalKey = parts[parts.length - 1];
    if (current[finalKey] === undefined) {
        console.error('Invalid path:', path);
        return null;
    }
    
    // Update the state
    const oldState = { ...current[finalKey] };
    current[finalKey] = { ...current[finalKey], ...data };
    
    // Special handling for device state changes
    if (path.startsWith('devices.')) {
        const deviceName = parts[parts.length - 1];
        
        // Calculate total light power
        const totalLightPower = calculateTotalLightPower();
        
        // Update energy usage and costs
        const newEnergyUsage = calculateEnergyUsage();
        const costs = calculateCosts(newEnergyUsage);
        
        state.environment.energy.current = newEnergyUsage;
        state.environment.energy.costs = costs;
        
        // Update temperature and humidity based on device states
        if (deviceName.includes('Light') && data.on !== undefined) {
            // Temperature change based on light power
            const tempChange = data.on ? 0.2 : -0.2;
            state.environment.temperature += tempChange;
            
            // Humidity changes based on multiple factors:
            // 1. Temperature (inverse relationship)
            // 2. AC/Heating operation
            // 3. Light operation (minor effect)
            let humidityChange = 0;
            
            // Temperature effect on humidity (inverse relationship)
            humidityChange -= tempChange * 0.5;
            
            // AC/Heating effect
            if (state.devices.thermostat.on) {
                if (state.environment.temperature > state.devices.thermostat.target) {
                    // AC running - decreases humidity
                    humidityChange -= 0.3;
                } else {
                    // Heating running - slight decrease in humidity
                    humidityChange -= 0.1;
                }
            }
            
            // Light operation effect (minor)
            humidityChange += data.on ? -0.1 : 0.1;
            
            // Apply humidity change with bounds
            state.environment.humidity = Math.max(30, Math.min(60, 
                state.environment.humidity + humidityChange));
        }
        
        // Log the changes with cost information
        console.log(`Device ${deviceName} updated:`, {
            old: oldState,
            new: current[finalKey],
            energy: newEnergyUsage,
            costs: costs,
            temperature: state.environment.temperature,
            humidity: state.environment.humidity
        });
    }
    
    return state;
}

// Helper function to calculate total light power
function calculateTotalLightPower() {
    let totalPower = 0;
    const lights = ['livingRoomLights', 'kitchenLights'];
    
    lights.forEach(light => {
        if (state.devices[light].on) {
            totalPower += (state.devices[light].brightness / 100) * 
                         state.devices[light].count * 60; // assume 60W per bulb at full brightness
        }
    });
    
    return totalPower;
}

// Add error handling for the HTTP server
http.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port or terminate the process using this port.`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Handle authentication
    socket.on('authenticate', (token) => {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            socket.userId = decoded.id;
            socket.authenticated = true;
            socket.emit('authenticated');
            console.log(`User ${socket.userId} authenticated`);
            
            // Calculate initial costs before sending state
            const initialEnergy = calculateEnergyUsage();
            state.environment.energy.current = initialEnergy;
            state.environment.energy.costs = calculateCosts(initialEnergy);
            
            // Send initial state after authentication
            socket.emit('deviceStateUpdated', state);
        } catch (error) {
            console.error('Authentication error:', error);
            socket.emit('auth_error', { message: 'Authentication failed' });
            socket.disconnect(true);
        }
    });
    
    // Handle getState request
    socket.on('getState', () => {
        if (!socket.authenticated) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        // Calculate current costs before sending state
        const currentEnergy = calculateEnergyUsage();
        state.environment.energy.current = currentEnergy;
        state.environment.energy.costs = calculateCosts(currentEnergy);
        
        socket.emit('deviceStateUpdated', state);
    });
    
    // Middleware to check authentication for all events except 'authenticate'
    socket.use(([event, ...args], next) => {
        if (event === 'authenticate') return next();
        if (!socket.authenticated) {
            return next(new Error('Not authenticated'));
        }
        next();
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        socket.emit('error', { message: 'An error occurred' });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
    
    // Handle device state update
    socket.on('updateDeviceState', ({ path, data }) => {
        if (!socket.authenticated) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        
        console.log('Updating state:', path, data);
        const newState = updateStatePath(path, data);
        
        if (newState) {
            // Broadcast the new state to all connected clients
            io.emit('deviceStateUpdated', newState);
            console.log('State updated and broadcast');
        } else {
            socket.emit('error', { message: 'Invalid update path or data' });
        }
    });
});

// Start server
const PORT = process.env.PORT || 3002;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Settings API endpoints
app.get('/api/settings', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            name: user.name,
            email: user.email,
            notifications: user.notifications || {
                email: false,
                push: false,
                types: {
                    deviceStatus: true,
                    energy: true,
                    security: true
                }
            },
            system: user.system || {
                temperatureUnit: 'fahrenheit',
                timezone: 'UTC',
                theme: 'light'
            },
            api: user.api || {
                key: generateApiKey(),
                webhookUrl: ''
            }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/settings/profile', authenticateToken, async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        const user = users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (currentPassword && newPassword) {
            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }
            user.password = await bcrypt.hash(newPassword, 10);
        }

        user.name = name || user.name;
        user.email = email || user.email;

        saveUsers();
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/settings/notifications', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.notifications = req.body;
        saveUsers();
        res.json({ message: 'Notification settings updated successfully' });
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/settings/system', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.system = req.body;
        saveUsers();
        res.json({ message: 'System settings updated successfully' });
    } catch (error) {
        console.error('Error updating system settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/settings/regenerate-key', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.api = user.api || {};
        user.api.key = generateApiKey();
        saveUsers();
        res.json({ key: user.api.key });
    } catch (error) {
        console.error('Error regenerating API key:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/settings/api', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.api = user.api || {};
        user.api.webhookUrl = req.body.webhookUrl;
        saveUsers();
        res.json({ message: 'API settings updated successfully' });
    } catch (error) {
        console.error('Error updating API settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Analytics API endpoints
app.get('/api/analytics', authenticateToken, (req, res) => {
    try {
        const analytics = {
            energy: {
                current: state.environment.energy.current,
                daily: state.environment.energy.daily,
                monthly: state.environment.energy.monthly,
                history: state.environment.energy.history
            },
            devices: {
                livingRoomLights: calculateDeviceUsage('livingRoomLights'),
                kitchenLights: calculateDeviceUsage('kitchenLights'),
                thermostat: calculateDeviceUsage('thermostat')
            },
            temperature: {
                current: state.environment.temperature,
                history: state.environment.temperatureHistory || []
            },
            cost: calculateCost()
        };

        res.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper functions
function generateApiKey() {
    return require('crypto').randomBytes(32).toString('hex');
}

function calculateDeviceUsage(deviceId) {
    const device = state.devices[deviceId];
    if (!device) return 0;

    // This is a simplified calculation - in a real app, you'd track actual usage time
    return device.on ? 1 : 0;
}

function calculateCost() {
    // Assuming $0.12 per kWh
    const kWh = state.environment.energy.current / 1000; // Convert W to kW
    return kWh * 0.12;
} 