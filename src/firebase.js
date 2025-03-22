import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAjq0jaRQ8pQfak-zXNf0jXgF5x1g4rqc0",
    authDomain: "fake-ito-boardgame-th.firebaseapp.com",
    projectId: "fake-ito-boardgame-th",
    storageBucket: "fake-ito-boardgame-th.firebasestorage.app",
    messagingSenderId: "36323179426",
    appId: "1:36323179426:web:a88809a21713dd7612d0fb",
    measurementId: "G-7RJK9P89VY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot }
