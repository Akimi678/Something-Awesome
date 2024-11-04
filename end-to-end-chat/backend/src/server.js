import express, { json } from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import morgan from 'morgan';
import errorHandler from 'middleware-http-errors';
import { registerUser, loginUser, getUser } from './user.js';
import { createARoom, getReceivers, getRoomDetail, getRoomsInfo, storeChat } from './chat.js';

const PORT = parseInt(process.env.PORT || '5050');

const app = express();

const wss = new WebSocketServer({ noServer: true });

app.use(json());
app.use(cors());
app.use(morgan('dev'));
app.disable('etag');

const activeUsers = new Map();

// register user
app.post('/user/register', (req, res) => {
    const { name, password } = req.body;
    try {
        const ret = registerUser(name, password);
        return res.status(200).json(ret);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// login user
app.post('/user/login', (req, res) => {
    const { name, password } = req.body;
    try {
        const ret = loginUser(name, password);
        return res.status(200).json(ret);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// create a room
app.post('/room', (req, res) => {
    const token = req.header('token');
    const { receivers } = req.body;
    try {
        const ret = createARoom(token, receivers);
        return res.status(200).json(ret);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// get info about all room the user is participating
app.get('/rooms', (req, res) => {
    const token = req.header('token');
    try {
        const ret = getRoomsInfo(token);
        return res.status(200).json(ret);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// get detail of a room
app.get('/room', (req, res) => {
    const token = req.header('token');
    const { roomId } = req.query;
    try {
        const ret = getRoomDetail(token, roomId);
        return res.status(200).json(ret);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// post a chat
app.post('/room/chat/:roomid', (req, res) => {
    const token = req.header('token');
    const roomId = parseInt(req.params.roomid);
    const { content } = req.body;
    try {
        const chatters = getReceivers(token, roomId);
        for (const chatter of chatters) {
            const client = activeUsers.get(chatter);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: "newMessage",
                    content,
                    roomId
                }));
            }
        }
        storeChat(token, content, roomId);
        res.status(200).json({ message: 'chat stored sucessfully'});
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// post public key for friends
app.post('/friend/send', (req, res) => {
    const token = req.header('token');
    const { publicKey } = req.body;
    try {
        const senderName = getUser(token);

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'overallSent',
                    senderName,
                    publicKey,
                }));
            }
        });
        res.status(200).json({ message: 'Data sent to clients successfully' });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

// post request for a publickey of friends
app.post('/friend/request', (req, res) => {
    const { friendName } = req.body;
    try {
        requestToFriend(friendName);
        res.status(200).json({ message: 'Requested friendship' });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message });
    }
});

app.use(errorHandler());

const server = app.listen(PORT, () => {
    try {
        console.log(`Server started on http://localhost:${PORT}`);
    } catch (error) {
        console.error(error.message);
    }
});

process.on('SIGINT', () => {
    try {
        console.log('Received SIGINT. Closing servers...');
        const timeout = setTimeout(() => {
            console.error('Forcing exit after timeout');
            process.exit(1);
        }, 5000); // 5 seconds timeout

        wss.close(() => {
            console.log('WebSocket server closed gracefully.');
            server.close(() => {
                console.log('HTTP server closed gracefully.');
                clearTimeout(timeout);
                process.exit(0);
            });
        });
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
});

wss.on('connection', (ws, req)=> {
    console.log('Client connected via WebSocket');
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'register') {
            const name = data.name;
            activeUsers.set(name, ws);
        }
        if (data.type === 'requestAccepted') {
            const requester = data.requester;
            const friend = activeUsers.get(requester);
            const publicKey = data.publicKey;

            if (friend && friend.readyState === WebSocket.OPEN) {
                friend.send(JSON.stringify({
                    type: 'requestAccepted',
                    friend: data.username,
                    publicKey,
                }));
            }
        }
    });
    
    ws.on('close', () => {
        activeUsers.forEach((value, key) => {
            activeUsers.delete(key);
        });
        console.log('Client disconnected');
    });
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

function requestToFriend(friendName) {
    const friend = activeUsers.get(friendName);
    if (friend && friend.readyState === WebSocket.OPEN) {
        friend.send(JSON.stringify({ type: 'friendRequest', requester: friend.name }));
    }
};