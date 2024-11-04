import fs from 'fs';
export const DATASTORE = 'database.json';

let data = {
    users: [],
    rooms: [],
}

function loadData() {
    try {
        const jsonData = fs.readFileSync(DATASTORE);
        data = JSON.parse(jsonData);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

export function getData() {
    return data;
}

export function setData(newData) {
    data = newData;
    fs.writeFileSync(DATASTORE, JSON.stringify(data, null, 2));
}

// Load data when the server starts
loadData();

