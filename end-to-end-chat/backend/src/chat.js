import {getData, setData} from './data.js';

export function createARoom (token, receivers) {
    const data = getData();
    const user = data.users.find(user => user.token === token);

    if (!user) {
        throw { status: 403, message: 'Invalid token' };
    }
    
    const id = getUniqueIdRoom(data);
    
    const chatters = [];
    const chatHistory = [];
    chatters.push(user.name);
    for (const rec of receivers) {
        const recver = data.users.find(user => user.name === rec);
        if (recver) {
            chatters.push(recver.name);
        } else {
            throw { status: 403, message: 'Unknown User' };
        }
    }

    data.rooms.push({
        id,
        chatters,
        chatHistory,
    });

    setData(data);

    return { roomId: id };
}

function getUniqueIdRoom(data) {
    const uniqueId = Math.floor(Math.random() * 100000);
    const sameId = data.rooms.find(room => room.id === uniqueId);
    if (sameId) {
        return getUniqueIdRoom(data);
    } else {
        return uniqueId;
    }
}

export function getRoomsInfo(token) {
    const data = getData();
    const user = data.users.find(user => user.token === token);

    if (!user) {
        throw { status: 403, message: 'Invalid token' };
    }
    
    const rooms = [];
    for (const room of data.rooms) {
        for (const chatter of room.chatters) {
            if (chatter === user.name) {
                const id = room.id;
                const chatters = room.chatters;
                const lastChat = room.chatHistory[room.chatHistory.length - 1];
                rooms.push({
                    id,
                    chatters,
                    lastChat
                });
            }
        }
    }

    return { rooms };
}

export function getRoomDetail(token, roomId) {
    const data = getData();
    const user = data.users.find(user => user.token === token);

    if (!user) {
        throw { status: 403, message: 'Invalid token' };
    }

    for (const room of data.rooms) {
        if (room.id === Number(roomId)) {
            return room;
        }
    }
    throw { status: 403, message: 'Room not find' };
}

export function storeChat(token, content, roomId) {
    const data = getData();
    const user = data.users.find(user => user.token === token);

    if (!user) {
        throw { status: 403, message: 'Invalid token' };
    }
    
    for (const room of data.rooms) {
        if (room.id === roomId) {
            const id = getUniqueIdChat(room);
            room.chatHistory.push({
                id: id,
                content: content,
                sender: user.name,
            });
            setData(data);
            return;
        }
    }
    
    throw { status: 500, message: 'Could not update chat'};
}

function getUniqueIdChat(room) {
    const uniqueId = Math.floor(Math.random() * 100000);
    const sameId = room.chatHistory.find(chat => chat.id === uniqueId);
    if (sameId) {
        return getUniqueIdChat(room);
    } else {
        return uniqueId;
    }
}

export function getReceivers(token, roomId) {
    const data = getData();
    const room = data.rooms.find(room => room.id === roomId);
    const user = data.users.find(user => user.token === token);

    if (room) {
        const chatters = [];
        for (const chatter of room.chatters) {
            if (chatter !== user.name) {
                chatters.push(chatter);
            }
        }
        return chatters;
    }
    throw { status: 403, message: 'Room not find' };
}