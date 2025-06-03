require('dotenv').config();
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const assert = require('assert');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test cases status
const testResults = {
    total: 0,
    passed: 0,
    failed: 0
};

function runTest(testName, testFn) {
    testResults.total++;
    try {
        testFn();
        console.log(`✅ ${testName} passed`);
        testResults.passed++;
    } catch (error) {
        console.error(`❌ ${testName} failed:`, error.message);
        testResults.failed++;
    }
}

// Create test tokens
const validToken = jwt.sign(
    { id: '1' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const invalidToken = 'invalid.token.here';

// Test suites
async function testAuthentication() {
    console.log('\n🔒 Running Authentication Tests...');

    // Test valid token
    const validSocket = io(SERVER_URL, {
        auth: { token: validToken }
    });

    await new Promise((resolve) => {
        validSocket.on('authenticated', (data) => {
            runTest('Valid token authentication', () => {
                assert(data.user.id === '1', 'User ID should match');
                assert(data.message === 'Successfully authenticated', 'Should receive success message');
            });
            validSocket.disconnect();
            resolve();
        });

        validSocket.on('connect_error', (error) => {
            runTest('Valid token authentication', () => {
                throw new Error(`Connection failed: ${error.message}`);
            });
            resolve();
        });
    });

    // Test invalid token
    const invalidSocket = io(SERVER_URL, {
        auth: { token: invalidToken }
    });

    await new Promise((resolve) => {
        invalidSocket.on('connect_error', (error) => {
            runTest('Invalid token rejection', () => {
                assert(error.message.includes('Invalid'), 'Should reject invalid token');
            });
            invalidSocket.disconnect();
            resolve();
        });
    });
}

async function testDeviceOperations() {
    console.log('\n💡 Running Device Operations Tests...');
    
    const socket = io(SERVER_URL, {
        auth: { token: validToken }
    });

    await new Promise((resolve) => {
        socket.on('authenticated', () => {
            socket.emit('requestInitialState');
        });

        socket.on('deviceStates', (devices) => {
            runTest('Device state structure', () => {
                assert(devices.lights, 'Should have lights array');
                assert(devices.climate, 'Should have climate array');
            });

            // Test device toggle
            const testDevice = devices.lights[0];
            socket.emit('toggleDevice', testDevice.id);
        });

        socket.on('deviceStateChanged', (data) => {
            runTest('Device toggle response', () => {
                assert(data.deviceId, 'Should return device ID');
                assert(typeof data.state === 'boolean', 'Should return boolean state');
            });

            // Test settings update
            socket.emit('updateDeviceSettings', {
                deviceId: data.deviceId,
                settings: { brightness: 75 }
            });
        });

        socket.on('deviceSettingsChanged', (data) => {
            runTest('Device settings update', () => {
                assert(data.settings.brightness === 75, 'Should update brightness to 75');
            });
            socket.disconnect();
            resolve();
        });
    });
}

async function testAutomations() {
    console.log('\n⚡ Running Automation Tests...');
    
    const socket = io(SERVER_URL, {
        auth: { token: validToken }
    });

    await new Promise((resolve) => {
        socket.on('deviceStates', (devices) => {
            if (devices.automations) {
                runTest('Night mode structure', () => {
                    assert(devices.automations.nightMode, 'Should have night mode automation');
                    assert(Array.isArray(devices.automations.nightMode.actions), 'Should have actions array');
                });

                runTest('Energy saver structure', () => {
                    assert(devices.automations.energySaver, 'Should have energy saver automation');
                    assert(Array.isArray(devices.automations.energySaver.peakHours), 'Should have peak hours array');
                });
            }
            socket.disconnect();
            resolve();
        });

        socket.emit('requestInitialState');
    });
}

async function testEnergyMonitoring() {
    console.log('\n📊 Running Energy Monitoring Tests...');
    
    const socket = io(SERVER_URL, {
        auth: { token: validToken }
    });

    await new Promise((resolve) => {
        socket.on('deviceStates', (devices) => {
            if (devices.energyUsage) {
                runTest('Energy usage structure', () => {
                    assert(typeof devices.energyUsage.current === 'number', 'Should have current usage');
                    assert(typeof devices.energyUsage.daily === 'number', 'Should have daily usage');
                    assert(typeof devices.energyUsage.monthly === 'number', 'Should have monthly usage');
                    assert(Array.isArray(devices.energyUsage.history), 'Should have usage history');
                });

                runTest('Energy usage history', () => {
                    const lastEntry = devices.energyUsage.history[devices.energyUsage.history.length - 1];
                    assert(lastEntry.timestamp, 'History should have timestamp');
                    assert(typeof lastEntry.usage === 'number', 'History should have usage value');
                });
            }
            socket.disconnect();
            resolve();
        });

        socket.emit('requestInitialState');
    });
}

// Run all tests
async function runAllTests() {
    try {
        await testAuthentication();
        await testDeviceOperations();
        await testAutomations();
        await testEnergyMonitoring();

        console.log('\n📝 Test Summary:');
        console.log(`Total Tests: ${testResults.total}`);
        console.log(`Passed: ${testResults.passed}`);
        console.log(`Failed: ${testResults.failed}`);

        process.exit(testResults.failed === 0 ? 0 : 1);
    } catch (error) {
        console.error('Test suite error:', error);
        process.exit(1);
    }
}

// Start tests
console.log('🚀 Starting Comprehensive Tests...');
runAllTests(); 