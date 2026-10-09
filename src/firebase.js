import { initializeApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator, set, get, onValue, remove } from "firebase/database";
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';

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
const auth = getAuth(app);

// ทดสอบในเครื่องกับ Firebase Emulator (database rules จริง ไม่แตะข้อมูล production): REACT_APP_FIREBASE_EMULATORS=true
if (process.env.REACT_APP_FIREBASE_EMULATORS === 'true') {
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

// ทุกคน sign-in แบบ anonymous ก่อนใช้ DB: database rules ใช้ auth.uid ระบุตัวผู้เล่น/host
// session เก็บใน browser refresh แล้วยังได้ uid เดิม (เรียกซ้ำได้ ใช้ promise เดียวกัน)
let signInPromise = null;
const ensureSignedIn = () => {
    if (!signInPromise) {
        signInPromise = auth.authStateReady()
            .then(() => auth.currentUser ?? signInAnonymously(auth).then((credential) => credential.user))
            .then((user) => user.uid)
            .catch((error) => {
                signInPromise = null; // ให้ลองใหม่ได้
                throw error;
            });
    }
    return signInPromise;
};

export { db, auth, ensureSignedIn, set, get, onValue, remove };
