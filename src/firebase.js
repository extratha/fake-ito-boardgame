import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc,deleteDoc, doc,onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCFAsHVcgDU_jIskVc2SskSo4ufKokeL_g",
    authDomain: "unique-number-931d0.firebaseapp.com",
    projectId: "unique-number-931d0",
    storageBucket: "unique-number-931d0.firebasestorage.app",
    messagingSenderId: "769264750690",
    appId: "1:769264750690:web:36d2679b136b5801da813b",
    measurementId: "G-TLR9Z95093"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, addDoc, updateDoc,deleteDoc, doc,onSnapshot}
