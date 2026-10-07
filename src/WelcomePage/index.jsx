import { getDatabase, ref, update, serverTimestamp } from "firebase/database";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Cookies from 'js-cookie';
import { withTimeout, reportDbError } from "../utils/connection";
import { getClientId } from "../utils/clientId";
import { cleanupRooms } from "../utils/roomCleanup";

const WelcomePage = () => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleUserNameChange = (event) => {
    setUserName(event.target.value)
    Cookies.set('userName', event.target.value, { expires: 7 });
  };
  // ฟังก์ชันสุ่มรหัสห้องที่มีทั้งตัวเลข พิมพ์เล็ก พิมพ์ใหญ่
  const generateRoomId = (length = 8) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    array.forEach(byte => {
      result += characters[byte % characters.length];
    });
    return result;
  };

  const handleCreateRoom = async () => {
    if (!userName) return alert('กรุณาระบุชื่อผู้เล่น')

    const db = getDatabase();
    const newRoomId = generateRoomId(); // สุ่มรหัสห้อง
    setIsCreating(true);
    try {
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
    navigate(`/room/${roomId}`); // ไปยังห้องที่ป้อนรหัส
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
              placeholder="รหัสห้อง"
              autoCapitalize="off"
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
