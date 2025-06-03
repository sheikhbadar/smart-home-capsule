# Smart Home Automation Simulation

A real-time smart home automation dashboard that allows you to control virtual devices (lights, fans, doors) with instant updates across all connected clients.

## Features

- Real-time device state updates using Socket.IO
- Modern, responsive UI
- Multiple device controls (lights, fans, doors)
- Instant synchronization across all connected browsers

## Prerequisites

- Node.js v14 or higher
- npm (Node Package Manager)

## Installation

1. Clone this repository or download the files
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

## How to Use

1. Open the dashboard in multiple browser windows/tabs
2. Click the toggle buttons to control different devices
3. Observe real-time updates across all connected windows
4. Each device's state is synchronized across all clients

## Project Structure

- `server.js` - Main server file with Express and Socket.IO setup
- `public/index.html` - Frontend dashboard with device controls
- `package.json` - Project dependencies and scripts

## Technologies Used

- Node.js
- Express.js
- Socket.IO
- HTML5
- CSS3
- JavaScript (ES6+) 