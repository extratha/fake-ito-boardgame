import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc,deleteDoc, doc,onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCFAsHVcgDU_jIskVc2SskSo4ufKokeL_g",
    authDomain: "unique-number-931d0.firebaseapp.com",
    projectId: "unique-number-931d0",
    storageBucket: "unique-number-931d0.firebasestorage.app",
    messagingSenderId: "769264750690",
    appId: "1:769264750690:web:db835e6abab4e7dcda813b",
    measurementId: "G-WXQQZEK1HS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, addDoc, updateDoc,deleteDoc, doc,onSnapshot}
