import { initializeApp } from 'firebase/app';
import { getDatabase, set, get, onValue, remove } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyAjq0jaRQ8pQfak-zXNf0jXgF5x1g4rqc0",
    authDomain: "fake-ito-boardgame-th.firebaseapp.com",
    projectId: "fake-ito-boardgame-th",
    databaseURL: "https://fake-ito-boardgame-th-default-rtdb.firebaseio.com", 
    storageBucket: "fake-ito-boardgame-th.firebasestorage.app",
    messagingSenderId: "36323179426",
    appId: "1:36323179426:web:a88809a21713dd7612d0fb",
    measurementId: "G-7RJK9P89VY"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, set, get, onValue, remove };
