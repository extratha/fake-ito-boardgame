import { getDatabase, ref, update, get, serverTimestamp } from "firebase/database";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Cookies from 'js-cookie';
import { withTimeout, reportDbError } from "../utils/connection";
import { getClientId } from "../utils/clientId";
import { cleanupRooms } from "../utils/roomCleanup";

// รหัสห้อง 4 ตัว: ตัวพิมพ์ใหญ่ + ตัวเลข ตัดตัวที่หน้าตาคล้ายกัน (0/O, 1/I/L) ออก ให้บอกกันปากเปล่าได้
export const ROOM_ID_LENGTH = 4;
export const ROOM_ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_ROOM_ID_ATTEMPTS = 10;

export const generateRoomId = (length = ROOM_ID_LENGTH) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => ROOM_ID_CHARS[byte % ROOM_ID_CHARS.length]).join('');
};

// รหัสแบบใหม่พิมพ์ตัวเล็กได้ ส่วนห้องเก่า (8 ตัว ตัวเล็ก/ใหญ่มีผล) ใช้ตามที่พิมพ์
export const normalizeRoomId = (value) =>
  value.length === ROOM_ID_LENGTH ? value.toUpperCase() : value;

// สุ่มจนได้รหัสที่ยังไม่มีห้องใช้อยู่
const findFreeRoomId = async (db) => {
  for (let attempt = 0; attempt < MAX_ROOM_ID_ATTEMPTS; attempt++) {
    const roomId = generateRoomId();
    const snapshot = await withTimeout(get(ref(db, `rooms/${roomId}`)), 'check room id');
    if (!snapshot.exists()) return roomId;
  }
  throw new Error('could not find a free room id');
};

const WelcomePage = () => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleUserNameChange = (event) => {
    setUserName(event.target.value)
    Cookies.set('userName', event.target.value, { expires: 7 });
  };

  const handleCreateRoom = async () => {
    if (!userName) return alert('กรุณาระบุชื่อผู้เล่น')

    const db = getDatabase();
    setIsCreating(true);
    try {
      const newRoomId = await findFreeRoomId(db);
      // เขียนห้อง + roomIndex พร้อมกัน (roomIndex ใช้ลบห้องที่ร้างโดยไม่ต้องโหลดข้อมูลทุกห้อง)
      await withTimeout(update(ref(db), {
        [`rooms/${newRoomId}`]: {
          host: userName,
          hostId: getClientId(),
          heart: 3,
          settings: { numbersPerPlayer: 1 },
          createdAt: serverTimestamp(),
        },
        [`roomIndex/${newRoomId}`]: { createdAt: serverTimestamp(), lastSeen: serverTimestamp() },
      }), 'create room');
      navigate(`/room/${newRoomId}`); // ไปยังห้องใหม่
    } catch (error) {
      reportDbError(error, 'create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!userName) return alert('กรุณาระบุชื่อผู้เล่น')
    if (!roomId) return alert('กรุณากรอกรหัสห้อง');
    navigate(`/room/${normalizeRoomId(roomId)}`); // ไปยังห้องที่ป้อนรหัส
  };

  const initUsername = () => {
    const value = Cookies.get('userName')
    setUserName(value || '')
  }

  useEffect(() => {
    initUsername()
    cleanupRooms(); // ลบห้องที่ร้างเกิน 10 นาที / อายุเกิน 1 วัน
  }, []);

  return (
    <div className="wrapper">
      <div className="stack welcome">
        <header className="welcome-hero">
          <div className="welcome-dice" aria-hidden="true">
            <span style={{ color: 'hsl(200, 100%, 40%)' }}>1</span>
            <span style={{ color: 'hsl(100, 100%, 40%)' }}>50</span>
            <span style={{ color: 'hsl(2, 100%, 40%)' }}>100</span>
          </div>
          <h1 className="welcome-title">Fake Ito Board Game</h1>
          <p className="hint">ใบ้คำตามเลขลับ แล้วเปิดไพ่เรียงจากน้อยไปมาก</p>
        </header>

        <section className="card">
          <label className="field btn-block">
            <span className="field-label">ชื่อผู้เล่น:</span>
            <input
              className="text-input"
              value={userName}
              placeholder="ระบุชื่อผู้เล่น"
              onChange={handleUserNameChange}
            />
          </label>
        </section>

        <section className="card">
          <h2 className="card-title">เข้าร่วมห้อง</h2>
          <label className="field btn-block">
            <span className="field-label">เลขที่ห้อง:</span>
            <input
              className="text-input"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.trim())}
              placeholder="รหัสห้อง 4 ตัว"
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </label>
          <button className="button-common btn-secondary btn-block btn-lg" onClick={handleJoinRoom}>เข้าร่วมห้อง</button>
        </section>

        <p className="divider">หรือ</p>
        <button className="button-common btn-primary btn-block btn-lg" onClick={handleCreateRoom} disabled={isCreating}>
          {isCreating ? 'กำลังสร้างห้อง...' : 'สร้างห้องใหม่'}
        </button>
      </div>
    </div>
  );
};

export default WelcomePage;
