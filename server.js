const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store device status
let deviceStatus = "offline";
let lastUpdate = null;
let deviceInfo = null;
let lastHeartbeat = Date.now();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to receive status updates from Pico W
app.post('/api/status', (req, res) => {
    const data = req.body;
    console.log('Received status update:', data);
    
    deviceStatus = "ready";
    lastUpdate = new Date().toISOString();
    lastHeartbeat = Date.now();
    
    deviceInfo = {
        device: data.device || "pico_w",
        device_id: data.device_id || "unknown",
        uptime: data.uptime || 0,
        uptime_formatted: formatUptime(data.uptime || 0),
        memory: data.memory || { free: 0, total: 0, percent_free: 0 }
    };
    
    // Broadcast to all connected clients
    io.emit('status_update', {
        status: deviceStatus,
        lastUpdate: lastUpdate,
        deviceInfo: deviceInfo
    });
    
    res.json({ success: true, received_at: new Date().toISOString() });
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Send current status to new client
    socket.emit('status_update', {
        status: deviceStatus,
        lastUpdate: lastUpdate,
        deviceInfo: deviceInfo
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Check if device is offline (no updates in 60 seconds)
setInterval(() => {
    if (deviceStatus === "ready" && Date.now() - lastHeartbeat > 60000) {
        deviceStatus = "offline";
        io.emit('status_update', {
            status: deviceStatus,
            lastUpdate: lastUpdate,
            deviceInfo: deviceInfo
        });
    }
}, 10000);

function formatUptime(seconds) {
    seconds = parseInt(seconds);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
