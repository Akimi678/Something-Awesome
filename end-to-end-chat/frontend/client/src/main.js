
// for frontend -> node server.js ${PORT}
// for backend -> npm start

let userName = ''; 
let privateKey = null; 
let publicKey = null;

let data = {
    userName,
    rooms: [],
    friends: [],
    privateKey,
    publicKey,
}

async function createKeys() {
    try {
        const keyPair = await fetchKeys();
        data.privateKey = await exportKey(keyPair.privateKey);
        data.publicKey = await exportKey(keyPair.publicKey);
        return data.publicKey;
    } catch (error) {
        throw error;
    }
}

async function fetchKeys() {
    try {
        const keyPair = await crypto.subtle.generateKey(
            {       
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"],
        );
        return keyPair;
    } catch (error) {
        throw error;
    };
}

async function exportKey(key) {
    return await crypto.subtle.exportKey('jwk', key);
}

async function importKey(exportedKey, type) {
    try {
        return await crypto.subtle.importKey(
            'jwk',
            exportedKey,
            {
                name: "RSA-OAEP",
                hash: { name: "SHA-256" },
            },
            true,
            type === 'private' ? ["decrypt"] : ["encrypt"]
        );
    } catch (error) {
        console.error("Error importing key:", error);
        throw error; 
    };
}

async function encryptMessage(message, publicKey) {
    const enc = new TextEncoder();
    const encoded = enc.encode(message);
    const encrypted = await crypto.subtle.encrypt(
        {
            name: "RSA-OAEP"
        },
        publicKey,
        encoded
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

async function decryptMessage(message, privateKey) {
    const binaryString = atob(message);
    const binaryArray = Uint8Array.from(binaryString, char => char.charCodeAt(0));
    
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "RSA-OAEP"
        },
        privateKey,
        binaryArray.buffer
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
}

async function fetchData(path, token, method, body) {
    try {
        const url = new URL('http://localhost:5050/' + path);
       
        const response = await fetch(url, {
            method: method,
            headers: {
                'token': `${token}`,
                'Content-type': 'application/json',
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorResponse = await response.json();
            throw new Error(errorResponse.message || `HTTP error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function getData(path, token, query) {
    try {
        const url = new URL('http://localhost:5050/' + path);
        if (query !== null) {
            url.search = new URLSearchParams(query).toString();
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'token': `${token}`,
                'Content-type': 'application/json',
            },
        });
        if (!response.ok) {
            const errorResponse = await response.json();
            throw new Error(errorResponse.message || `HTTP error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function showRooms() {
    const token = localStorage.getItem('token');
    getData('rooms', token, null
    ).then(async res => {
        for (const room of res.rooms) {
            const newRoom = document.createElement('div');
            newRoom.id = `room-${room.id}`;
            const chatters = document.createElement('p');
            const lastChat = document.createElement('p');
            lastChat.id = `lastchat-${room.id}`
            for (const chatter of room.chatters) {
                chatters.textContent += chatter + ' ';
            }
            if (room.lastChat) {
                const encoded = room.lastChat.content.find(e => e.receiver === data.userName);
                const decoded = await decryptMessage(encoded.message, await importKey(data.privateKey, 'private'));
                lastChat.textContent = decoded;
            }
            newRoom.appendChild(chatters);
            newRoom.appendChild(lastChat);
            document.getElementById('rooms-container').appendChild(newRoom);
        }
    });
}

async function removeChildren(id) {
    const container = document.getElementById(id);
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

const ws = new WebSocket('ws://localhost:5050');

ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'friendRequest') {
        ws.send(JSON.stringify({ 
            type: 'requestAccepted', 
            requester: message.requester, 
            username: data.userName, 
            publicKey: data.publicKey
        }));
    }
    if (message.type === 'reqestAccepted') {
        const name = message.friend;
        const publicKey = message.publicKey;
        data.friends.push({
            name: name,
            publicKey: publicKey,
        });
    }
    if (message.type === 'newMessage') {
        if (parseInt(message.roomId) 
            === parseInt(document.getElementById('room-id').textContent)) {
            const encoded = message.content.find(e => e.receiver === data.userName);
            const mes = await decryptMessage(encoded.message, await importKey(data.privateKey, 'private'));
    
            const newChat = document.createElement('div');
            newChat.className = 'chat';
            const sender = document.createElement('p');
            const text = document.createElement('p');
            sender.textContent = encoded.sender;
            text.textContent = mes;
            newChat.appendChild(sender);
            newChat.appendChild(text);
            document.getElementById('chats-container').appendChild(newChat);
        } else {
            const room = document.getElementById(`room-${message.roomId}`);
            if (room) {
                const encoded = message.content.find(e => e.receiver === data.userName);
                const decoded = await decryptMessage(encoded.message, await importKey(data.privateKey, 'private'));
                document.getElementById(`lastchat-${message.roomId}`).textContent = decoded;
            } else {
                removeChildren('rooms-container');
                showRooms();
            }
        }
    }
    if (message.type === 'overallSent') {
        const name = message.senderName;
        const publicKey = message.publicKey;
        data.friends.push({
            name: name,
            publicKey: publicKey,
        });
    }
};

ws.onclose = () => {
    localStorage.setItem(`${data.userName}-data`, JSON.stringify(data))
};

window.addEventListener('beforeunload', () => {
    localStorage.setItem(`${data.userName}-data`, JSON.stringify(data));
    ws.close();
});

document.getElementById('login-register').addEventListener('click', () => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('register').style.display = 'block';
});

document.getElementById('register-login').addEventListener('click', () => {
    document.getElementById('register').style.display = 'none';
    document.getElementById('login').style.display = 'block';
});

document.getElementById('login-submit').addEventListener('click', () => {
    const name = document.getElementById('login-name').value;
    const password = document.getElementById('login-password').value;
    fetchData('user/login', null, 'POST', {
        name,
        password,
    }).then(async res => {
        localStorage.setItem('token', res.token);

        await removeChildren('rooms-container');
        await showRooms();
            
        document.getElementById('login-name').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login').style.display = 'none';
        document.getElementById('rooms').style.display = 'block';
        
        ws.send(JSON.stringify({ type: 'register', name }));
        data = JSON.parse(localStorage.getItem(`${name}-data`));
    }).catch(err => {
        alert(err.message);
    });
});

document.getElementById('register-submit').addEventListener('click', () => {
    const name = document.getElementById('register-name').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    if (password !== confirm) {
        alert('The passwords not same');
    } else {
        fetchData('user/register', null, 'POST', {
            name,
            password,
        }).then(async res1 => {
            localStorage.setItem('token', res1.token);
            data.userName = name;
            ws.send(JSON.stringify({ type: 'register', name }));

            const publicKey = await createKeys();

            fetchData('friend/send', res1.token, 'POST', {
                publicKey,
            }).then(res2 => {
                console.log(res2);

                document.getElementById('register-name').value = '';
                document.getElementById('register-password').value = '';
                document.getElementById('register-confirm').value = '';
                document.getElementById('register').style.display = 'none';
                document.getElementById('rooms').style.display = 'block';

                data.userName = name;
            }).catch(err => {
                alert(err.message);
            });
        }).catch(err => {
            alert(err.message);
        });
    }
});

document.getElementById('create-room').addEventListener('click', () => {
    document.getElementById('rooms').style.display = 'none';
    document.getElementById('create').style.display = 'block';
});

document.getElementById('add-more-mate').addEventListener('click', () => {
    const newMate = document.createElement('input');
    newMate.type = 'text';
    newMate.placeholder = 'roommate ' + (document.querySelectorAll('#mate-container input').length + 1);
    newMate.id = 'mate-' + (document.querySelectorAll('#mate-container input').length + 1);

    document.getElementById('mate-container').appendChild(newMate);
});

document.getElementById('create-submit').addEventListener('click', () => {
    const token = localStorage.getItem('token');
    const receivers = [];
    const inputs = document.querySelectorAll('#mate-container input');

    for (const input of inputs) {
        if (input.value !== '') {
            receivers.push(input.value);
            input.value = '';
        }
    }

    fetchData('room', token, 'POST', {
       receivers,
    }).then(async res => {
        console.log(res);

        await removeChildren('rooms-container');
        await showRooms();

        document.getElementById('create').style.display = 'none';
        document.getElementById('rooms').style.display = 'block';
    }).catch(err => {
        alert(err.message);
    });
});

document.getElementById('rooms-container').addEventListener('click', (event) => {
    removeChildren('chats-container');
    const token = localStorage.getItem('token');
    const targetElement = event.target.closest('div[id^="room-"]');
    if (targetElement) {
        const roomId = targetElement.id.replace('room-', '');
        getData('room', token, { roomId }
        ).then(async room => {
            document.getElementById('room-id').textContent = room.id;

            for (const chatter of room.chatters) {
                const roommate = document.createElement('p');
                roommate.textContent = chatter;
                document.getElementById('room-friends').appendChild(roommate);
                const friend = data.friends.find(friend => friend.name === chatter);
                if (!friend) {
                    const friendName = chatter;
                    fetchData('friend/request', token, 'POST', {
                        friendName,
                    }).then(res => {
                        console.log(res);
                    }).catch(err => {
                        alert(err.message);
                    });
                }
            }

            let i = 0;
            while (i <= room.chatHistory.length - 1) {
                const newChat = document.createElement('div');
                newChat.className = 'chat';
                const sender = document.createElement('p');
                const message = document.createElement('p');
                sender.textContent = room.chatHistory[i].sender;
                const encoded = room.chatHistory[i].content.find(e => e.receiver === data.userName);
                message.textContent = await decryptMessage(encoded.message, await importKey(data.privateKey, 'private'));
                newChat.appendChild(sender);
                newChat.appendChild(message);
                document.getElementById('chats-container').appendChild(newChat);
                i++;
            }

            document.getElementById('show-room').style.display = 'block';
        }).catch(err => {
            alert(err.message);
        });
    }
});

document.getElementById('chat-input').addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
        const content = [];
        const message = document.getElementById('chat-input').value;
        const friends = document.getElementById('room-friends');
        const roomid = document.getElementById('room-id').textContent;
        Array.from(friends.children).forEach(async (child) => {
            const friend = data.friends.find(friend => friend.name === child.textContent);
            console.log(friend);
            const encoded = await encryptMessage(message, await importKey(friend.publicKey, 'public'));
            content.push({
                message: encoded,
                receiver: friend.name,
                sender: data.userName,
            });
        });
        const encoded = await encryptMessage(message, await importKey(data.publicKey, 'public'));
        content.push({
            message: encoded,
            receiver: data.userName,
            sender: data.userName,
        });
        const token = localStorage.getItem('token');
        console.log(token);
        fetchData(`room/chat/${roomid}`, token, 'POST', {
            content,
        }).then(res => {
            console.log(res);
        }).catch(err => {
            alert(err.message);
        });

        const newChat = document.createElement('div');
        newChat.className = "chat";
        const sender = document.createElement('p');
        const text = document.createElement('p');
        sender.textContent = data.userName;
        text.textContent = message;
        newChat.appendChild(sender);
        newChat.appendChild(text);
        document.getElementById('chats-container').appendChild(newChat);
        document.getElementById('chat-input').value = '';
    }
});

document.getElementById('refresh').addEventListener('click', () => {
    removeChildren('rooms-container');
    showRooms();
});