const WebSocket = require('ws');
const process = require('process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Setup logging
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, `server-${new Date().toISOString().split('T')[0]}.log`);

// Logger function
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    // Log to console
    console.log(logMessage);

    // Log to file
    fs.appendFileSync(logFile, logMessage + '\n');
}

// Error logger
function logError(message, error) {
    const errorDetails = error ? `\n${error.stack || error}` : '';
    log(`${message}${errorDetails}`, 'ERROR');
}

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
        argMap[args[i].substring(2)] = args[i + 1];
    }
}

// Set configuration with priority: command line args > environment variables > defaults
const HOST = argMap.host || process.env.QUANTA_CHAT_HOST || 'localhost';
const PORT = parseInt(argMap.port || process.env.QUANTA_CHAT_PORT || '8080', 10);
const HTTP_PORT = parseInt(argMap.httpPort || process.env.QUANTA_CHAT_HTTP_PORT || '8000', 10);

log(`Starting QuantaChatServer with HOST=${HOST}, HTTP_PORT=${HTTP_PORT}, WS_PORT=${PORT}`);

// Cache for all static files (including main HTML)
const staticFileCache = new Map();

// Create HTTP server to serve static files
const server = http.createServer((req, res) => {
    try {
        const startTime = Date.now();
        log(`HTTP Request: ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

        // Parse the URL to separate path from query parameters
        let urlObj;
        try {
            urlObj = new URL(req.url, `http://${req.headers.host}`);
        } catch (error) {
            logError(`Invalid URL: ${req.url}`, error);
            res.writeHead(400);
            res.end('Bad Request: Invalid URL');
            return;
        }

        const pathname = urlObj.pathname;

        // Handle requests for files in the public directory
        if (pathname.startsWith('/public/')) {
            try {
                const filePath = path.join(__dirname, pathname);

                // Get file extension to set correct content type
                const extname = path.extname(filePath);
                let contentType = 'text/html';

                switch (extname) {
                    case '.js':
                        contentType = 'text/javascript';
                        break;
                    case '.css':
                        contentType = 'text/css';
                        break;
                    case '.json':
                        contentType = 'application/json';
                        break;
                    case '.png':
                        contentType = 'image/png';
                        break;
                    case '.jpg':
                        contentType = 'image/jpg';
                        break;
                    case '.jpeg':
                        contentType = 'image/jpeg';
                        break;
                }

                // Check if the file is in cache
                if (staticFileCache.has(filePath)) {
                    // Serve from cache
                    const cachedContent = staticFileCache.get(filePath);
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(cachedContent);
                    log(`Served static file from cache: ${pathname} (${Date.now() - startTime}ms)`);
                    return;
                }

                // Read and serve the file
                fs.readFile(filePath, (err, content) => {
                    try {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                // File not found
                                res.writeHead(404);
                                res.end('File not found');
                                log(`404 File not found: ${pathname} (${Date.now() - startTime}ms)`);
                            } else {
                                // Server error
                                logError(`Error reading file ${filePath}`, err);
                                res.writeHead(500);
                                res.end('Server Error');
                            }
                            return;
                        }

                        // Cache the file content
                        staticFileCache.set(filePath, content);

                        // Success - send the file
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(content, 'utf-8');
                        log(`Served static file: ${pathname} (${Date.now() - startTime}ms)`);
                    } catch (innerError) {
                        logError(`Error processing file read callback for ${pathname}`, innerError);
                        if (!res.headersSent) {
                            res.writeHead(500);
                            res.end('Server Error');
                        }
                    }
                });
            } catch (error) {
                logError(`Error processing public file request: ${pathname}`, error);
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end('Server Error');
                }
            }
        } else if (pathname === '/') {
            try {
                // Serve the QuantaChat.html file (using cache if available)
                const filePath = path.join(__dirname, 'QuantaChat.html');

                if (staticFileCache.has(filePath)) {
                    // Serve from cache
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(staticFileCache.get(filePath), 'utf-8');
                    log(`Served QuantaChat.html from cache (${Date.now() - startTime}ms)`);
                } else {
                    // Read from file and cache for future requests
                    fs.readFile(filePath, 'utf-8', (err, content) => {
                        try {
                            if (err) {
                                logError('Error loading QuantaChat.html', err);
                                res.writeHead(500);
                                res.end('Error loading QuantaChat.html');
                                return;
                            }

                            // Replace placeholders with actual values
                            content = content.replace(/{{HOST}}/g, HOST)
                                .replace(/{{PORT}}/g, PORT.toString());

                            // Cache the processed content
                            staticFileCache.set(filePath, content);

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(content, 'utf-8');
                            log(`Served QuantaChat.html with dynamic values and cached (${Date.now() - startTime}ms)`);
                        } catch (innerError) {
                            logError('Error in file read callback for QuantaChat.html', innerError);
                            if (!res.headersSent) {
                                res.writeHead(500);
                                res.end('Server Error');
                            }
                        }
                    });
                }
            } catch (error) {
                logError('Error serving QuantaChat.html', error);
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end('Server Error');
                }
            }
        } else {
            // Handle 404 for other routes
            res.writeHead(404);
            res.end('Page not found');
            log(`404 Not Found: ${pathname} (${Date.now() - startTime}ms)`);
        }
    } catch (error) {
        logError(`Uncaught error in HTTP request handler: ${req.url}`, error);
        if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

// Add global error handler to prevent crashes
server.on('error', (error) => {
    logError('HTTP server error', error);
});

// Start HTTP server
server.listen(HTTP_PORT, HOST, () => {
    log(`HTTP server running on http://${HOST}:${HTTP_PORT}`);
});

// Create WebSocket server (separate from HTTP)
const wss = new WebSocket.Server({
    host: HOST,
    port: PORT
});

log(`Signaling server running on ws://${HOST}:${PORT}`);

// Track client connections with more information
const clients = new Map(); // Map of WebSocket -> {room, name}
const rooms = new Map();   // Map of roomId -> Set of client names in the room

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    log(`New WebSocket client connected from ${clientIp}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            log(`Received message: ${data.type} from ${clients.get(ws)?.name || 'unknown'}`);

            // Handle join message
            if (data.type === 'join') {
                const room = data.room;
                const name = data.name || `user-${Math.floor(Math.random() * 10000)}`;

                // Store client info
                clients.set(ws, { room, name });

                // Update room participants
                if (!rooms.has(room)) {
                    rooms.set(room, new Set());
                }
                rooms.get(room).add(name);

                log(`Client ${name} joined room: ${room}`);

                // Send the current participants list to the new client
                const participants = Array.from(rooms.get(room));
                ws.send(JSON.stringify({
                    type: 'room-info',
                    participants: participants.filter(p => p !== name),
                    room
                }));

                // Notify others about the new participant
                wss.clients.forEach((client) => {
                    if (client !== ws &&
                        client.readyState === WebSocket.OPEN &&
                        clients.get(client)?.room === room) {
                        client.send(JSON.stringify({
                            type: 'user-joined',
                            name: name,
                            room
                        }));
                    }
                });
            }

            // For WebRTC signaling messages (offer, answer, ice-candidate)
            if ((data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') && data.target) {
                const client = clients.get(ws);

                if (client) {
                    const room = client.room;
                    const sender = client.name;

                    // Add sender info to the message
                    data.sender = sender;
                    data.room = room;

                    // Find the target client and send the message
                    wss.clients.forEach((client) => {
                        const clientInfo = clients.get(client);
                        if (client.readyState === WebSocket.OPEN &&
                            clientInfo &&
                            clientInfo.room === room &&
                            clientInfo.name === data.target) {
                            log(`Sending ${data.type} from ${sender} to ${data.target} in room ${room}`);
                            client.send(JSON.stringify(data));
                        }
                    });
                } else {
                    log("Received signaling message but client not in a room", "WARN");
                }
            }
            // Handle broadcast messages to everyone in a room
            else if (data.type === 'broadcast' && data.room) {
                const client = clients.get(ws);
                if (client) {
                    data.sender = client.name;
                    wss.clients.forEach((c) => {
                        const clientInfo = clients.get(c);
                        if (c !== ws &&
                            c.readyState === WebSocket.OPEN &&
                            clientInfo &&
                            clientInfo.room === data.room) {
                            log(`Broadcasting message in room ${data.room} from ${client.name}`);
                            c.send(JSON.stringify(data));
                        }
                    });
                }
            }

        } catch (error) {
            logError("Error processing WebSocket message", error);
        }
    });

    ws.on('close', (code, reason) => {
        const client = clients.get(ws);
        if (client) {
            const { room, name } = client;
            log(`Client ${name} disconnected from room: ${room} (Code: ${code}, Reason: ${reason || 'none'})`);

            // Remove from room participants
            if (rooms.has(room)) {
                rooms.get(room).delete(name);

                // If room is empty, remove it
                if (rooms.get(room).size === 0) {
                    rooms.delete(room);
                    log(`Room ${room} deleted as it's now empty`);
                } else {
                    // Notify others about the participant leaving
                    wss.clients.forEach((c) => {
                        if (c.readyState === WebSocket.OPEN &&
                            clients.get(c)?.room === room) {
                            c.send(JSON.stringify({
                                type: 'user-left',
                                name: name,
                                room
                            }));
                        }
                    });
                }
            }

            clients.delete(ws);
        } else {
            log(`Unknown client disconnected (Code: ${code})`, "WARN");
        }
    });

    ws.on('error', (error) => {
        logError("WebSocket client error", error);

        // Try to get client info for better logging
        const client = clients.get(ws);
        if (client) {
            log(`Error for client ${client.name} in room ${client.room}`, "ERROR");
        }
    });
});

// Add error handler to WebSocket server
wss.on('error', (error) => {
    logError("WebSocket server error", error);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
    logError("UNCAUGHT EXCEPTION - Server continuing to run:", error);
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logError("UNHANDLED PROMISE REJECTION:", reason);
});

log("QuantaChatServer initialization complete");
