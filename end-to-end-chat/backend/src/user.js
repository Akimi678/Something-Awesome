import {randomBytes, pbkdf2Sync} from 'crypto';
import {getData, setData} from './data.js';

export function registerUser(name, password) {
    const data = getData();
    const uniqueId = getUniqueId(data);
    const encryptedPass = hashPassword(password);
    const token = generateToken();

    const sameName = data.users.find(user => user.name === name);
    if (sameName) {
        throw { status: 401, message: 'Name is already used' };
    }

    data.users.push({
        id: uniqueId,
        name: name,
        password: encryptedPass,
        token: token
    });
    setData(data);
    return { token };
}

function getUniqueId (data) {
    const uniqueId = Math.floor(Math.random() * 10000);
    const sameId = data.users.find(user => user.id === uniqueId);
    if (sameId) {
        return getUniqueId(data);
    } else {
        return uniqueId;
    }
}

function hashPassword (rawPassword) {
    const salt = randomBytes(16).toString('hex');
    const iterations = 10000;
    const keylen = 64;
    const algo = 'sha256';

    const password = pbkdf2Sync(rawPassword, salt, iterations, keylen, algo).toString('hex');

    return { password, salt }
}

function generateToken() {
    return randomBytes(32).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') 
    .replace(/=+$/, '');
}

export function loginUser(name, password) {
    const data = getData();
    const match = data.users.find(user => user.name === name && passwordSame(user.password, password));

    if (match) {
        const token = generateToken();
        match.token = token;
        setData(data);
        return { token };
    }
    
    throw { status: 401, message: 'Either of name and password is wrong' };
}

function passwordSame(password, rawPassword) {
    const salt = password.salt;
    const iterations = 10000;
    const keylen = 64;
    const algo = 'sha256';

    const checkPass = pbkdf2Sync(rawPassword, salt, iterations, keylen, algo).toString('hex');

    if (checkPass === password.password) {
        return true;
    } else {
        return false;
    }
}

export function getUser(token) {
    const data = getData();
    const user = data.users.find(user => user.token === token);

    if (!user) {
        throw { status: 403, message: 'Invalid token' };
    }
    const name = user.name
    return name;
}