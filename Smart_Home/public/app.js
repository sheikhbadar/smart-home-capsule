// Socket.IO connection
if (typeof window.socket === 'undefined') {
    window.socket = io({
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: false  // Don't connect automatically
    });
}

// Authentication state
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser'));

// Socket authentication handlers
window.socket.on('authenticated', () => {
    console.log('Socket authenticated');
    updateUserProfile();
    window.socket.emit('getState');
});

window.socket.on('auth_error', (error) => {
    console.error('Authentication error:', error);
    // Clear invalid credentials and redirect to login
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/login.html';
});

// Update user profile in the UI
function updateUserProfile() {
    if (!currentUser) return;
    
    const userNameElement = document.querySelector('.user-name');
    const userEmailElement = document.querySelector('.user-email');
    
    if (userNameElement) {
        userNameElement.textContent = currentUser.name || 'Guest User';
    }
    if (userEmailElement) {
        userEmailElement.textContent = currentUser.email || 'guest@example.com';
    }
}

// Navigation handling
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const currentPath = window.location.pathname;
    const publicPaths = ['/login.html', '/signup.html', '/'];
    
    if (!authToken && !publicPaths.includes(currentPath)) {
        window.location.href = '/login.html';
        return;
    }

    // Setup navigation
    setupNavigation();

    // Connect socket and authenticate if we have a token
    if (authToken) {
        window.socket.connect();
        window.socket.emit('authenticate', authToken);
        updateUserProfile();
    }

    // Initialize features
    initializeBudget();
    initializeMiniChart();

    // Setup logout handler
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Initialize dark mode from localStorage
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('darkModeToggle').checked = true;
    }

    // Add dark mode toggle event listener
    document.getElementById('darkModeToggle').addEventListener('change', function(e) {
        const isDarkMode = e.target.checked;
        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem('darkMode', isDarkMode);
    });
});

// Logout handler
function handleLogout() {
    // Clear authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    // Disconnect socket
    if (window.socket) {
        window.socket.disconnect();
    }
    
    // Redirect to login
    window.location.href = '/login.html';
}

// Store chart instances and data globally
let energyChart = null;
let temperatureChart = null;
let chartData = {
    energy: {
        labels: [],
        usage: [],
        costs: []
    },
    temperature: {
        labels: [],
        values: []
    }
};

// Budget monitoring
let monthlyBudget = parseFloat(localStorage.getItem('monthlyBudget')) || 0;

// Initialize budget functionality
function initializeBudget() {
    const budgetButton = document.querySelector('.budget-input button');
    if (budgetButton) {
        budgetButton.addEventListener('click', setBudget);
    }
    
    // Set initial budget value if it exists
    const budgetInput = document.getElementById('monthlyBudget');
    if (budgetInput && monthlyBudget > 0) {
        budgetInput.value = monthlyBudget;
    }
}

function setBudget() {
    const budgetInput = document.getElementById('monthlyBudget');
    const newBudget = parseFloat(budgetInput.value);
    
    if (isNaN(newBudget) || newBudget < 0) {
        showNotification('error', 'Invalid Budget', 'Please enter a valid budget amount');
        return;
    }

    monthlyBudget = newBudget;
    localStorage.setItem('monthlyBudget', newBudget.toString());
    
    // Show success notification
    showNotification('success', 'Budget Updated', `Monthly budget set to $${newBudget.toFixed(2)}`);
    
    // Request current state to update budget alerts
    window.socket.emit('getState');
}

function updateBudgetStatus(projectedMonthlyCost) {
    const budgetAlert = document.getElementById('budgetAlert');
    const budgetInput = document.getElementById('monthlyBudget');
    
    // Update input field with current budget
    if (budgetInput && !budgetInput.value) {
        budgetInput.value = monthlyBudget;
    }
    
    if (!monthlyBudget) {
        if (budgetAlert) {
            budgetAlert.textContent = 'Set a monthly budget to monitor your energy spending';
            budgetAlert.className = 'budget-alert';
        }
        return;
    }
    
    const usagePercentage = (projectedMonthlyCost / monthlyBudget) * 100;
    
    // Create or update budget progress bar
    let budgetStatus = document.querySelector('.budget-status');
    if (!budgetStatus) {
        budgetStatus = document.createElement('div');
        budgetStatus.className = 'budget-status';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'budget-progress';
        const bar = document.createElement('div');
        bar.className = 'budget-progress-bar';
        progressBar.appendChild(bar);
        budgetStatus.appendChild(progressBar);
        
        const percentageText = document.createElement('div');
        percentageText.className = 'budget-percentage';
        budgetStatus.appendChild(percentageText);
        
        if (budgetAlert && budgetAlert.parentNode) {
            budgetAlert.parentNode.insertBefore(budgetStatus, budgetAlert.nextSibling);
        }
    }
    
    const progressBar = budgetStatus.querySelector('.budget-progress-bar');
    const percentageText = budgetStatus.querySelector('.budget-percentage');
    
    if (progressBar && percentageText) {
        // Animate the progress bar
        progressBar.style.transition = 'width 0.3s ease-out, background-color 0.3s ease-out';
        progressBar.style.width = Math.min(100, usagePercentage) + '%';
        percentageText.textContent = usagePercentage.toFixed(1) + '%';
        
        // Update colors and messages based on usage percentage
        if (usagePercentage >= 100) {
            budgetAlert.textContent = `Budget exceeded! Current projection: $${projectedMonthlyCost.toFixed(2)}`;
            budgetAlert.className = 'budget-alert danger';
            progressBar.className = 'budget-progress-bar danger';
        } else if (usagePercentage >= 80) {
            budgetAlert.textContent = `Warning: Approaching budget limit. Current: $${projectedMonthlyCost.toFixed(2)}`;
            budgetAlert.className = 'budget-alert warning';
            progressBar.className = 'budget-progress-bar warning';
        } else {
            budgetAlert.textContent = `Current monthly projection: $${projectedMonthlyCost.toFixed(2)}`;
            budgetAlert.className = 'budget-alert';
            progressBar.className = 'budget-progress-bar';
        }
    }
}

// Function to show notifications
function showNotification(type, title, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    
    const container = document.getElementById('notificationContainer');
    if (container) {
        container.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

// Function to update chart data
function updateChartData(state) {
    if (!state || !state.environment || !state.environment.energy) {
        console.warn('Invalid state data for chart update');
        return;
    }

    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const energyKwh = (state.environment.energy.current / 1000).toFixed(2);
    const costs = state.environment.energy.costs || {
        hourly: 0,
        daily: 0,
        monthly: 0,
        savings: 0
    };

    // Update energy chart data
    chartData.energy.labels.push(currentTime);
    chartData.energy.usage.push(parseFloat(energyKwh));
    chartData.energy.costs.push(parseFloat(costs.hourly || 0));

    // Keep only last 8 data points for better visualization
    if (chartData.energy.labels.length > 8) {
        chartData.energy.labels.shift();
        chartData.energy.usage.shift();
        chartData.energy.costs.shift();
    }

    // Update temperature chart data
    if (state.environment.temperature !== undefined) {
        chartData.temperature.labels.push(currentTime);
        chartData.temperature.values.push(state.environment.temperature);

        // Keep only last 7 data points for temperature
        if (chartData.temperature.labels.length > 7) {
            chartData.temperature.labels.shift();
            chartData.temperature.values.shift();
        }
    }

    // Update charts if they exist and are visible
    const analyticsSection = document.getElementById('analytics-section');
    if (analyticsSection && analyticsSection.style.display !== 'none') {
        if (energyChart) {
            energyChart.data.labels = chartData.energy.labels;
            energyChart.data.datasets[0].data = chartData.energy.usage;
            energyChart.data.datasets[1].data = chartData.energy.costs;
            energyChart.update('none'); // Update without animation for real-time feel
        }

        if (temperatureChart) {
            temperatureChart.data.labels = chartData.temperature.labels;
            temperatureChart.data.datasets[0].data = chartData.temperature.values;
            temperatureChart.update('none');
        }
    }
}

// Chart initialization with cost data
function initializeCharts() {
    // Destroy existing charts if they exist
    if (energyChart) {
        energyChart.destroy();
        energyChart = null;
    }
    if (temperatureChart) {
        temperatureChart.destroy();
        temperatureChart = null;
    }

    // Reset chart data
    chartData = {
        energy: {
            labels: [],
            usage: [],
            costs: []
        },
        temperature: {
            labels: [],
            values: []
        }
    };

    // Energy Usage Chart
    const energyCtx = document.getElementById('energyChart');
    if (energyCtx) {
        energyChart = new Chart(energyCtx, {
            type: 'line',
            data: {
                labels: chartData.energy.labels,
                datasets: [{
                    label: 'Energy Usage (kWh)',
                    data: chartData.energy.usage,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    yAxisID: 'y'
                }, {
                    label: 'Cost ($)',
                    data: chartData.energy.costs,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Real-time Energy Usage & Cost'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Energy Usage (kWh)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Cost ($)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    // Temperature Chart
    const tempCtx = document.getElementById('temperatureChart');
    const currentTempUnit = getCurrentTempUnit();
    const tempSuffix = currentTempUnit === 'F' ? '°F' : '°C';

    if (tempCtx) {
        temperatureChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: chartData.temperature.labels,
                datasets: [{
                    label: `Temperature (${tempSuffix})`,
                    data: chartData.temperature.values.map(temp => 
                        convertTemperature(temp, 'F', currentTempUnit)
                    ),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Real-time Temperature'
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: `Temperature (${tempSuffix})`
                        }
                    }
                }
            }
        });
    }
}

function updateCharts(chartData) {
    const currentTempUnit = getCurrentTempUnit();
    const tempSuffix = currentTempUnit === 'F' ? '°F' : '°C';

    if (tempChartCanvas?.chart) {
        tempChartCanvas.chart.data.labels = chartData.temperature.labels;
        tempChartCanvas.chart.data.datasets[0].data = chartData.temperature.values.map(temp => 
            convertTemperature(temp, 'F', currentTempUnit)
        );
        tempChartCanvas.chart.data.datasets[0].label = `Temperature (${tempSuffix})`;
        tempChartCanvas.chart.options.scales.y.title.text = `Temperature (${tempSuffix})`;
        tempChartCanvas.chart.update('none');
    }
}

// Add cleanup function for charts when leaving analytics section
function cleanupCharts() {
    if (energyChart) {
        energyChart.destroy();
        energyChart = null;
    }
    if (temperatureChart) {
        temperatureChart.destroy();
        temperatureChart = null;
    }
}

// Setup navigation function
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    // Function to show a specific section
    function showSection(sectionId) {
        contentSections.forEach(section => {
            if (section.id === sectionId) {
                section.classList.add('active');
                section.style.display = 'block';
            } else {
                section.classList.remove('active');
                section.style.display = 'none';
                // Clean up charts when leaving analytics section
                if (section.id === 'analytics-section') {
                    cleanupCharts();
                }
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            console.log('Switching to page:', page);
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Show corresponding content
            const sectionId = `${page}-section`;
            showSection(sectionId);
            
            // Request state update when switching to dashboard
            if (page === 'dashboard') {
                window.socket.emit('getState');
            }
            
            // Initialize charts if analytics section
            if (page === 'analytics') {
                initializeCharts();
            }
        });
    });

    // Set initial active state
    const initialPage = window.location.pathname === '/' ? 'dashboard' : 
                       window.location.pathname.split('/').pop().replace('.html', '');
    const initialNavItem = document.querySelector(`.nav-item[data-page="${initialPage}"]`) ||
                          document.querySelector('.nav-item[data-page="dashboard"]');
            
    if (initialNavItem) {
        initialNavItem.classList.add('active');
        const sectionId = `${initialNavItem.getAttribute('data-page')}-section`;
        showSection(sectionId);
    }

    // Setup user profile
    updateUserProfile();

    // Setup logout
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.socket.disconnect();
            window.location.href = '/login.html';
        });
    }
}

// Device state handling
window.socket.on('deviceStateUpdated', (state) => {
    console.log('Received state update:', state);
    updateUI(state);
    updateMiniAnalytics(state);
    analyzeEnergyUsage(state); // Add analytics processing
    
    // Calculate and update budget status whenever device state changes
    if (state.environment && state.environment.energy) {
        const currentUsage = state.environment.energy.current / 1000; // Convert W to kW
        const hourlyRate = 0.12; // $0.12 per kWh
        const hoursInMonth = 24 * 30; // 24 hours * 30 days
        const projectedMonthlyCost = currentUsage * hourlyRate * hoursInMonth;
        
        // Update budget progress bar with the new projected cost
        updateBudgetStatus(projectedMonthlyCost);
        
        // Show energy usage notification
        showNotification(
            'info',
            'Energy Update',
            `Current Usage: ${currentUsage.toFixed(2)} kW
Hourly Cost: $${(currentUsage * hourlyRate).toFixed(2)}
Monthly Projection: $${projectedMonthlyCost.toFixed(2)}`
        );
    }
});

// Initialize mini energy chart
let miniEnergyChart = null;
let energyData = {
    labels: [],
    values: [],
    movingAverage: [],
    peak: { start: null, end: null }
};

function calculateMovingAverage(data, window = 3) {
    return data.map((val, idx, arr) => {
        const start = Math.max(0, idx - window + 1);
        const subset = arr.slice(start, idx + 1);
        return subset.reduce((sum, num) => sum + num, 0) / subset.length;
    });
}

function initializeMiniChart() {
    const ctx = document.getElementById('miniEnergyChart');
    if (!ctx) return;

    miniEnergyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Current Usage',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Average Trend',
                data: [],
                borderColor: 'rgba(255, 159, 64, 0.8)',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Today\'s Energy Usage',
                    font: {
                        size: 14
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} kW`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        maxTicksLimit: 5,
                        callback: function(value) {
                            return value.toFixed(1) + ' kW';
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 6
                    }
                }
            }
        }
    });
}

function updateMiniAnalytics(state) {
    if (!state.environment || !state.environment.energy) return;

    const currentTime = new Date();
    const timeStr = currentTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
    
    // Update energy data
    const currentUsage = state.environment.energy.current / 1000; // Convert to kW
    energyData.labels.push(timeStr);
    energyData.values.push(currentUsage);

    // Keep last 12 data points (2 hours if updating every 10 minutes)
    if (energyData.labels.length > 12) {
        energyData.labels.shift();
        energyData.values.shift();
    }

    // Calculate moving average
    energyData.movingAverage = calculateMovingAverage(energyData.values);

    // Calculate daily usage and trend
    const dailyUsage = energyData.values.reduce((sum, val) => sum + val, 0) / energyData.values.length * 24;
    const previousDayUsage = state.environment.energy.previousDay || dailyUsage * 0.9;
    const trend = ((dailyUsage - previousDayUsage) / previousDayUsage) * 100;

    // Update daily usage display with color coding
    const dailyUsageElement = document.getElementById('dailyUsageValue');
    const dailyTrendElement = document.getElementById('dailyUsageTrend');
    
    if (dailyUsageElement) {
        dailyUsageElement.textContent = `${dailyUsage.toFixed(2)} kWh`;
        // Color code based on usage level
        const usageLevel = dailyUsage > previousDayUsage * 1.1 ? 'high' : 
                          dailyUsage < previousDayUsage * 0.9 ? 'low' : 'normal';
        dailyUsageElement.setAttribute('data-usage-level', usageLevel);
    }
    if (dailyTrendElement) {
        dailyTrendElement.textContent = `${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend).toFixed(1)}%`;
        dailyTrendElement.setAttribute('data-trend', trend >= 0 ? 'up' : 'down');
        dailyTrendElement.style.color = trend >= 0 ? '#ff4444' : '#00C851';
    }

    // Find peak hours and patterns
    if (energyData.values.length >= 2) {
        let maxUsage = Math.max(...energyData.values);
        let peakIndex = energyData.values.indexOf(maxUsage);
        let peakTime = energyData.labels[peakIndex];
        
        const peakHoursElement = document.getElementById('peakHoursValue');
        if (peakHoursElement) {
            const peakHour = parseInt(peakTime.split(':')[0]);
            const peakTimeRange = `${peakHour}:00 to ${peakHour + 1}:00`;
            const peakUsageLevel = maxUsage > dailyUsage * 1.5 ? 'High Peak' : 
                                 maxUsage > dailyUsage * 1.2 ? 'Moderate Peak' : 'Normal Usage';
            peakHoursElement.textContent = `${peakTimeRange} (${peakUsageLevel})`;
            peakHoursElement.setAttribute('data-peak-level', peakUsageLevel.toLowerCase().replace(' ', '-'));
        }
    }

    // Update mini chart
    if (miniEnergyChart) {
        miniEnergyChart.data.labels = energyData.labels;
        miniEnergyChart.data.datasets[0].data = energyData.values;
        miniEnergyChart.data.datasets[1].data = energyData.movingAverage;
        miniEnergyChart.update('none');
    }
}

// Temperature conversion functions
function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

function fahrenheitToCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5/9;
}

function convertTemperature(temp, fromUnit, toUnit) {
    if (fromUnit === toUnit) return temp;
    if (fromUnit === 'C' && toUnit === 'F') return celsiusToFahrenheit(temp);
    if (fromUnit === 'F' && toUnit === 'C') return fahrenheitToCelsius(temp);
    return temp;
}

// Get current temperature unit from settings
function getCurrentTempUnit() {
    const tempUnitSelect = document.querySelector('.settings-select[onchange="updateTempUnit(this.value)"]');
    return tempUnitSelect ? tempUnitSelect.value : 'F';
}

function updateUI(state) {
    const currentTempUnit = getCurrentTempUnit();
    const tempSuffix = currentTempUnit === 'F' ? '°F' : '°C';

    // Update device cards in dashboard
    Object.entries(state.devices).forEach(([deviceId, device]) => {
        // Update dashboard section
        const dashboardCard = document.querySelector(`#dashboard-${deviceId}`);
        if (dashboardCard) {
            // Update toggle switch
            const toggleInput = dashboardCard.querySelector('input[type="checkbox"]');
            if (toggleInput) {
                toggleInput.checked = device.on;
            }

            // Update brightness slider
            const brightnessSlider = dashboardCard.querySelector('input[type="range"]');
            if (brightnessSlider && device.brightness !== undefined) {
                brightnessSlider.value = device.brightness;
            }

            // Update thermostat display
            if (deviceId === 'thermostat') {
                const currentTemp = dashboardCard.querySelector('#dashboard-thermostatTemp');
                const targetTemp = dashboardCard.querySelector('#dashboard-targetTemp');
                if (currentTemp) {
                    const convertedTemp = convertTemperature(device.current, 'F', currentTempUnit);
                    currentTemp.textContent = `${Math.round(convertedTemp)}${tempSuffix}`;
                }
                if (targetTemp) {
                    const convertedTarget = convertTemperature(device.target, 'F', currentTempUnit);
                    targetTemp.textContent = `Target: ${Math.round(convertedTarget)}${tempSuffix}`;
                }
            }
        }

        // Update devices section
        const devicesCard = document.querySelector(`#devices-${deviceId}`);
        if (devicesCard) {
            // Update toggle switch
            const toggleInput = devicesCard.querySelector('input[type="checkbox"]');
            if (toggleInput) {
                toggleInput.checked = device.on;
            }

            // Update brightness slider
            const brightnessSlider = devicesCard.querySelector('input[type="range"]');
            if (brightnessSlider && device.brightness !== undefined) {
                brightnessSlider.value = device.brightness;
            }

            // Update thermostat display
            if (deviceId === 'thermostat') {
                const currentTemp = devicesCard.querySelector('#devices-thermostatTemp');
                const targetTemp = devicesCard.querySelector('#devices-targetTemp');
                if (currentTemp) {
                    const convertedTemp = convertTemperature(device.current, 'F', currentTempUnit);
                    currentTemp.textContent = `${Math.round(convertedTemp)}${tempSuffix}`;
                }
                if (targetTemp) {
                    const convertedTarget = convertTemperature(device.target, 'F', currentTempUnit);
                    targetTemp.textContent = `Target: ${Math.round(convertedTarget)}${tempSuffix}`;
                }
            }
        }
    });

    // Update environment status
    const tempElement = document.querySelector('#current-temperature');
    if (tempElement) {
        const convertedTemp = convertTemperature(state.environment.temperature, 'F', currentTempUnit);
        tempElement.textContent = `${Math.round(convertedTemp)}${tempSuffix}`;
    }

    const humidityElement = document.querySelector('#current-humidity');
    if (humidityElement) {
        humidityElement.textContent = `${Math.round(state.environment.humidity)}%`;
    }

    // Update energy and cost information
    if (state.environment && state.environment.energy) {
        const energyKwh = (state.environment.energy.current / 1000).toFixed(2);
        const costs = state.environment.energy.costs || {
            hourly: 0,
            daily: 0,
            monthly: 0,
            savings: 0
        };
        
        const energyElement = document.querySelector('#current-energy');
        if (energyElement) {
            energyElement.textContent = `${energyKwh} kWh`;
        }
        
        const costElement = document.querySelector('#current-cost');
        if (costElement) {
            costElement.innerHTML = `
                <div>Current Rate: $${(costs.hourly || 0).toFixed(2)}/hour</div>
                <div>Projected Daily: $${(costs.daily || 0).toFixed(2)}</div>
                <div>Projected Monthly: $${(costs.monthly || 0).toFixed(2)}</div>
            `;
        }
        
        // Update budget progress bar
        if (costs.monthly !== undefined) {
            updateBudgetStatus(costs.monthly);
        }
        
        // Update savings display
        const savingsElement = document.querySelector('#energy-savings');
        if (savingsElement) {
            const savings = costs.savings || 0;
            const savingsClass = savings > 0 ? 'savings-positive' : 'savings-negative';
            savingsElement.innerHTML = `
                <div class="${savingsClass}">
                    ${savings > 0 ? 'Saving' : 'Extra Cost'}: $${Math.abs(savings).toFixed(2)}/hour
                </div>
                <div>
                    ${getEfficiencyTips(state.devices)}
                </div>
            `;
        }

        // Update charts with new data
        updateChartData(state);
    }

    // Update system status
    const homeAwayElement = document.querySelector('#home-away-status');
    if (homeAwayElement) {
        homeAwayElement.textContent = state.system.homeAway.toUpperCase();
        homeAwayElement.className = `status-pill status-${state.system.homeAway.toLowerCase()}`;
    }

    const securityElement = document.querySelector('#security-status');
    if (securityElement) {
        securityElement.textContent = state.system.armed ? 'ARMED' : 'DISARMED';
        securityElement.className = `status-pill status-${state.system.armed ? 'armed' : 'disarmed'}`;
    }

    // Update mini analytics
    updateMiniAnalytics(state);
}

// Device control functions
function toggleDevice(deviceId) {
    // Find the toggle input in both dashboard and devices sections
    const dashboardToggle = document.querySelector(`#dashboard-${deviceId} input[type="checkbox"]`);
    const devicesToggle = document.querySelector(`#devices-${deviceId} input[type="checkbox"]`);
    
    // Use whichever toggle was clicked
    const toggleInput = dashboardToggle?.checked !== undefined ? dashboardToggle : devicesToggle;
    if (!toggleInput) return;

    // Show immediate feedback for the specific device
    const deviceName = deviceId.replace(/([A-Z])/g, ' $1').trim();
    const status = toggleInput.checked ? 'on' : 'off';
    showNotification(
        'info',
        'Device Update',
        `${deviceName} turned ${status}`
    );

    // Update device state
    window.socket.emit('updateDeviceState', {
        path: `devices.${deviceId}`,
        data: { on: toggleInput.checked }
    });
}

function updateLightBrightness(deviceId) {
    // Find the brightness slider in both dashboard and devices sections
    const dashboardSlider = document.querySelector(`#dashboard-${deviceId} input[type="range"]`);
    const devicesSlider = document.querySelector(`#devices-${deviceId} input[type="range"]`);
    
    // Use whichever slider was changed
    const brightnessSlider = dashboardSlider?.value !== undefined ? dashboardSlider : devicesSlider;
    if (!brightnessSlider) return;

    const brightness = parseInt(brightnessSlider.value);
    const deviceName = deviceId.replace(/([A-Z])/g, ' $1').trim();
    
    // Show immediate feedback for the specific device
    showNotification(
        'info',
        'Brightness Update',
        `${deviceName} brightness set to ${brightness}%\nEstimated cost: $${calculateDeviceCost(deviceId, brightness).toFixed(2)}/hour`
    );

    // Update device state
    window.socket.emit('updateDeviceState', {
        path: `devices.${deviceId}`,
        data: { brightness: brightness }
    });
}

// Helper function to calculate device cost
function calculateDeviceCost(deviceId, brightness) {
    const ratePerKwh = 0.12; // $0.12 per kWh
    const wattsPerBulb = 60; // 60W per bulb at full brightness
    let numberOfBulbs = 1;
    
    // Determine number of bulbs based on device
    if (deviceId === 'livingRoomLights') {
        numberOfBulbs = 4;
    } else if (deviceId === 'kitchenLights') {
        numberOfBulbs = 2;
    }
    
    // Calculate power usage based on brightness
    const actualWatts = (wattsPerBulb * brightness / 100) * numberOfBulbs;
    const kW = actualWatts / 1000;
    
    return kW * ratePerKwh;
}

function adjustTemperature(change) {
    const currentTempUnit = getCurrentTempUnit();
    
    // Find the target temperature in both dashboard and devices sections
    const dashboardTemp = document.querySelector('#dashboard-targetTemp');
    const devicesTemp = document.querySelector('#devices-targetTemp');
    
    // Use whichever section is currently visible
    const targetTemp = dashboardTemp?.style.display !== 'none' ? dashboardTemp : devicesTemp;
    if (!targetTemp) return;

    // Extract the current target temperature and convert it to Fahrenheit for the backend
    const currentTargetText = targetTemp.textContent.match(/\d+/)[0];
    const currentTarget = parseInt(currentTargetText);
    
    // Convert the change amount based on the current unit
    const adjustedChange = currentTempUnit === 'C' ? change * 1.8 : change;
    
    // Get the current target in Fahrenheit
    const currentTargetF = currentTempUnit === 'C' ? 
        celsiusToFahrenheit(currentTarget) : 
        currentTarget;
    
    // Calculate new target in Fahrenheit
    const newTargetF = currentTargetF + adjustedChange;

    window.socket.emit('updateDeviceState', {
        path: 'devices.thermostat',
        data: { target: newTargetF }
    });
}

function toggleEcoMode() {
    // Find the eco mode toggle in both dashboard and devices sections
    const dashboardToggle = document.querySelector('#dashboard-ecoModeToggle');
    const devicesToggle = document.querySelector('#devices-ecoModeToggle');
    
    // Use whichever toggle was clicked
    const ecoModeToggle = dashboardToggle?.checked !== undefined ? dashboardToggle : devicesToggle;
    if (!ecoModeToggle) return;

    window.socket.emit('updateDeviceState', {
        path: 'devices.thermostat',
        data: { ecoMode: ecoModeToggle.checked }
    });
}

// Cost calculation functions
function getEfficiencyTips(devices) {
    const tips = [];
    
    // Check light brightness
    Object.entries(devices).forEach(([deviceId, device]) => {
        if (deviceId.includes('Lights') && device.on) {
            if (device.brightness > 80) {
                tips.push(`Consider reducing ${device.name} brightness to save energy`);
            }
        }
    });
    
    // Check thermostat
    if (devices.thermostat) {
        const temp = devices.thermostat.target;
        if (!devices.thermostat.ecoMode) {
            tips.push('Enable Eco Mode to optimize energy usage');
        }
        if (temp < 68 || temp > 78) {
            tips.push('Adjust thermostat to 72°F for optimal efficiency');
        }
    }
    
    return tips.length > 0 
        ? `<ul class="efficiency-tips">${tips.map(tip => `<li>${tip}</li>`).join('')}</ul>`
        : '<div class="optimal-message">Running at optimal efficiency</div>';
}

// Update device state handling to include cost notifications
function updateDeviceState(data) {
    // ... existing state update code ...
    
    // Update UI with new state
    updateUI(data);
    
    // Show cost notification when devices change state
    if (data.environment && data.environment.energy && data.environment.energy.costs) {
        const costs = data.environment.energy.costs;
        const hourlyRate = 0.12; // $0.12 per kWh
        const currentUsage = data.environment.energy.current / 1000; // Convert W to kW
        const hourlyCost = currentUsage * hourlyRate;
        
        showNotification(
            'info',
            'Energy Usage Update',
            `Current usage: ${currentUsage.toFixed(2)} kW
             Hourly cost: $${hourlyCost.toFixed(2)}
             Projected monthly: $${costs.monthly.toFixed(2)}`
        );
    }
}

// Add CSS styles for the progress bar animations
const style = document.createElement('style');
style.textContent = `
    .budget-progress {
        width: 100%;
        height: 8px;
        background-color: #e0e0e0;
        border-radius: 4px;
        margin: 10px 0;
        overflow: hidden;
    }

    .budget-progress-bar {
        height: 100%;
        background-color: var(--primary-color);
        transition: width 0.3s ease-out, background-color 0.3s ease-out;
        border-radius: 4px;
        min-width: 0%;
    }

    .budget-progress-bar.warning {
        background-color: #ff9800;
    }

    .budget-progress-bar.danger {
        background-color: #f44336;
    }

    .budget-percentage {
        font-size: 14px;
        color: var(--text-secondary);
        margin-top: 5px;
        text-align: right;
        transition: color 0.3s ease-out;
    }

    .budget-alert {
        margin-top: 10px;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.3s ease-out, color 0.3s ease-out;
    }

    .budget-alert.warning {
        background-color: #fff3e0;
        color: #f57c00;
    }

    .budget-alert.danger {
        background-color: #ffebee;
        color: #d32f2f;
    }
`;
document.head.appendChild(style);

// Analytics state
let analyticsState = {
    warnings: [],
    efficiency: {
        lighting: 0,
        hvac: 0,
        overall: 0
    },
    recommendations: [],
    consumption: {
        current: 0,
        baseline: 0,
        extra: 0
    }
};

// Function to calculate efficiency and generate warnings
function analyzeEnergyUsage(state) {
    const warnings = [];
    const recommendations = [];
    let lightingEfficiency = 100;
    let hvacEfficiency = 100;
    let extraConsumption = 0;
    let baselineConsumption = 0;

    // Analyze lighting efficiency
    const activeLights = ['livingRoomLights', 'kitchenLights'].filter(light => state.devices[light].on);
    const totalBrightness = activeLights.reduce((sum, light) => sum + state.devices[light].brightness, 0);
    
    if (activeLights.length > 0) {
        // Calculate baseline and extra consumption for lights
        activeLights.forEach(light => {
            const device = state.devices[light];
            const optimalBrightness = 60; // Optimal brightness level
            const actualConsumption = (device.brightness / 100) * device.count * 60; // 60W per bulb
            const baselineConsumption = (optimalBrightness / 100) * device.count * 60;
            
            if (device.brightness > optimalBrightness) {
                extraConsumption += actualConsumption - baselineConsumption;
                recommendations.push(`Reduce ${device.name} brightness from ${device.brightness}% to ${optimalBrightness}% to save ${((actualConsumption - baselineConsumption) * 0.12).toFixed(2)}$/hour`);
            }
        });

        // Check if multiple rooms have lights on
        if (activeLights.length > 1) {
            lightingEfficiency -= 15;
            const potentialSavings = activeLights.reduce((sum, light) => {
                return sum + (state.devices[light].brightness / 100) * state.devices[light].count * 60;
            }, 0) * 0.12;
            warnings.push(`Multiple rooms (${activeLights.length}) have lights on - potential savings of $${potentialSavings.toFixed(2)}/hour by using one room at a time`);
        }
    }

    // Analyze HVAC efficiency
    const thermostat = state.devices.thermostat;
    if (thermostat.on) {
        const optimalTemp = 72;
        const optimalRange = 2;
        
        // Calculate HVAC consumption
        const tempDiff = Math.abs(thermostat.current - thermostat.target);
        const actualConsumption = tempDiff * 100; // 100W per degree difference
        const optimalConsumption = optimalRange * 100;
        
        if (!thermostat.ecoMode) {
            hvacEfficiency -= 30;
            const ecoSavings = actualConsumption * 0.3; // Eco mode typically saves 30%
            recommendations.push(`Enable ECO mode to save approximately $${(ecoSavings * 0.12).toFixed(2)}/hour`);
            extraConsumption += ecoSavings;
        }

        // Check temperature differential
        if (tempDiff > optimalRange) {
            hvacEfficiency -= 20;
            const extraHVACCost = ((tempDiff - optimalRange) * 100 * 0.12).toFixed(2);
            warnings.push(`Temperature differential of ${tempDiff}°F is costing an extra $${extraHVACCost}/hour`);
            extraConsumption += (tempDiff - optimalRange) * 100;
        }

        // Add temperature optimization recommendation
        if (Math.abs(thermostat.target - optimalTemp) > optimalRange) {
            const potentialSavings = (Math.abs(thermostat.target - optimalTemp) - optimalRange) * 100 * 0.12;
            recommendations.push(`Set temperature closer to ${optimalTemp}°F to save up to $${potentialSavings.toFixed(2)}/hour`);
        }
    }

    // Calculate overall efficiency and consumption metrics
    const overallEfficiency = Math.round((lightingEfficiency + hvacEfficiency) / 2);
    const currentConsumption = state.environment.energy.current;
    baselineConsumption = currentConsumption - extraConsumption;

    // Update analytics state
    analyticsState = {
        warnings,
        efficiency: {
            lighting: lightingEfficiency,
            hvac: hvacEfficiency,
            overall: overallEfficiency
        },
        recommendations,
        consumption: {
            current: currentConsumption,
            baseline: baselineConsumption,
            extra: extraConsumption
        }
    };

    // Update analytics display
    updateAnalyticsDisplay();
    
    // Show warning notification if efficiency is low
    if (overallEfficiency < 70) {
        const potentialSavings = (extraConsumption * 0.12).toFixed(2);
        showNotification('warning', 'Energy Efficiency Alert', 
            `Current system efficiency: ${overallEfficiency}%. Potential savings: $${potentialSavings}/hour`);
    }
}

// Function to update analytics display
function updateAnalyticsDisplay() {
    const analyticsSection = document.getElementById('analytics-section');
    if (!analyticsSection) return;

    // Update efficiency meters
    const efficiencyMeters = analyticsSection.querySelectorAll('.efficiency-meter');
    efficiencyMeters.forEach(meter => {
        const type = meter.dataset.type;
        const efficiency = analyticsState.efficiency[type];
        const bar = meter.querySelector('.efficiency-bar');
        const value = meter.querySelector('.efficiency-value');
        
        if (bar && value) {
            bar.style.width = `${efficiency}%`;
            bar.className = `efficiency-bar ${getEfficiencyClass(efficiency)}`;
            value.textContent = `${efficiency}%`;
        }
    });

    // Update consumption metrics
    const consumptionDetails = document.querySelector('.consumption-details');
    if (consumptionDetails) {
        const hourlyRate = 0.12; // $0.12 per kWh
        const currentCost = (analyticsState.consumption.current / 1000 * hourlyRate).toFixed(2);
        const extraCost = (analyticsState.consumption.extra / 1000 * hourlyRate).toFixed(2);
        const baselineCost = (analyticsState.consumption.baseline / 1000 * hourlyRate).toFixed(2);
        
        consumptionDetails.innerHTML = `
            <div class="consumption-metric">
                <span>Current Consumption:</span>
                <span>${(analyticsState.consumption.current / 1000).toFixed(2)} kWh ($${currentCost}/hour)</span>
            </div>
            <div class="consumption-metric warning">
                <span>Extra Consumption:</span>
                <span>${(analyticsState.consumption.extra / 1000).toFixed(2)} kWh ($${extraCost}/hour)</span>
            </div>
            <div class="consumption-metric success">
                <span>Optimal Baseline:</span>
                <span>${(analyticsState.consumption.baseline / 1000).toFixed(2)} kWh ($${baselineCost}/hour)</span>
            </div>
        `;
    }

    // Update warnings list
    const warningsList = analyticsSection.querySelector('.warnings-list');
    if (warningsList) {
        warningsList.innerHTML = analyticsState.warnings.length > 0 
            ? analyticsState.warnings.map(warning => `<li class="warning-item">${warning}</li>`).join('')
            : '<li>No active warnings</li>';
    }

    // Update recommendations
    const recommendationsList = analyticsSection.querySelector('.recommendations-list');
    if (recommendationsList) {
        recommendationsList.innerHTML = analyticsState.recommendations.length > 0
            ? analyticsState.recommendations.map(rec => `<li class="recommendation-item">${rec}</li>`).join('')
            : '<li>No current recommendations</li>';
    }

    // Update charts
    updateAnalyticsCharts();
}

// Function to update analytics charts
function updateAnalyticsCharts() {
    const energyChartCanvas = document.getElementById('analyticsEnergyChart');
    const tempChartCanvas = document.getElementById('analyticsTempChart');
    
    if (energyChartCanvas && !energyChartCanvas.chart) {
        energyChartCanvas.chart = new Chart(energyChartCanvas, {
            type: 'line',
            data: {
                labels: chartData.energy.labels,
                datasets: [{
                    label: 'Current Usage (kWh)',
                    data: chartData.energy.usage,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.4
                }, {
                    label: 'Optimal Usage (kWh)',
                    data: chartData.energy.usage.map(val => val * 0.7), // Assuming 70% is optimal
                    borderColor: 'rgb(54, 162, 235)',
                    borderDash: [5, 5],
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Energy Usage Analysis' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Energy (kWh)' }
                    }
                }
            }
        });
    }

    if (tempChartCanvas && !tempChartCanvas.chart) {
        tempChartCanvas.chart = new Chart(tempChartCanvas, {
            type: 'line',
            data: {
                labels: chartData.temperature.labels,
                datasets: [{
                    label: 'Temperature (°F)',
                    data: chartData.temperature.values,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.4
                }, {
                    label: 'Optimal Range',
                    data: chartData.temperature.values.map(() => 72), // Optimal temperature line
                    borderColor: 'rgb(75, 192, 192)',
                    borderDash: [5, 5],
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Temperature Analysis' }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'Temperature (°F)' }
                    }
                }
            }
        });
    }

    // Update chart data
    if (energyChartCanvas?.chart) {
        energyChartCanvas.chart.data.labels = chartData.energy.labels;
        energyChartCanvas.chart.data.datasets[0].data = chartData.energy.usage;
        energyChartCanvas.chart.data.datasets[1].data = chartData.energy.usage.map(val => val * 0.7);
        energyChartCanvas.chart.update('none');
    }

    if (tempChartCanvas?.chart) {
        tempChartCanvas.chart.data.labels = chartData.temperature.labels;
        tempChartCanvas.chart.data.datasets[0].data = chartData.temperature.values;
        tempChartCanvas.chart.update('none');
    }
}

// Helper function to get efficiency class
function getEfficiencyClass(efficiency) {
    if (efficiency >= 80) return 'high';
    if (efficiency >= 60) return 'medium';
    return 'low';
}

function updateTempUnit(unit) {
    // Save the temperature unit preference
    localStorage.setItem('temperatureUnit', unit);
    
    // Update all temperature displays
    const state = window.currentState;
    if (state) {
        updateUI(state);
        updateCharts(chartData);
    }
}

// Initialize temperature unit from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedUnit = localStorage.getItem('temperatureUnit') || 'F';
    const tempUnitSelect = document.querySelector('.settings-select[onchange="updateTempUnit(this.value)"]');
    if (tempUnitSelect) {
        tempUnitSelect.value = savedUnit;
    }
});

// Rest of the code...
// ... existing code ... 