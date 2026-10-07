import { getDatabase, ref, set, serverTimestamp, get, remove } from "firebase/database";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Cookies from 'js-cookie';

const WelcomePage = () => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
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
    const roomRef = ref(db, `rooms/${newRoomId}`);

    await set(roomRef, {
      host: userName, // สมมติว่าค่าตัวแปรนี้มาจากผู้ใช้จริง
      // players: { ["userName"]: { username: "userName" } },
      numbers: [],
      revealNumbers: [],
      heart: 3,
      createdAt: serverTimestamp(),
    });

    navigate(`/room/${newRoomId}`); // ไปยังห้องใหม่
  };

  const handleJoinRoom = () => {
    if (!userName) return alert('กรุณาระบุชื่อผู้เล่น')
    if (!roomId) return alert('กรุณากรอกรหัสห้อง');
    navigate(`/room/${roomId}`); // ไปยังห้องที่ป้อนรหัส
  };

  const clearExpiredRoom = async () => {
    const db = getDatabase();
    const roomsRef = ref(db, 'rooms'); // จุดที่เก็บข้อมูลห้องทั้งหมด
  
    try {
      const snapshot = await get(roomsRef); // ดึงข้อมูลห้องทั้งหมด
      const rooms = snapshot.val();
      if (rooms) {
        const currentTimestamp = Date.now();
  
        // ใช้ for...of แทน forEach เพื่อให้ await ทำงานตามลำดับ
        for (const roomId of Object.keys(rooms)) {
          const roomData = rooms[roomId];
          const createdAt = roomData.createdAt; // สมมติว่า field นี้เก็บเวลาเมื่อสร้าง room
  
          // ตรวจสอบว่า createdAt มีค่าเป็นตัวเลขและห้องนั้นหมดอายุแล้ว
          if (createdAt && currentTimestamp - createdAt > 86400000) { // 86400000 มิลลิวินาที = 1 วัน
            console.log(`Deleting room: ${roomId} because it is older than 1 day`);
            await remove(ref(db, `rooms/${roomId}`)); // ลบห้องนั้นออกจากฐานข้อมูล
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up rooms: ', error);
    }
  };

  const initUsername = () => {
    const value = Cookies.get('userName')
    setUserName(value || '')
  }

  useEffect(() => {
    // เรียกใช้ฟังก์ชัน clearExpiredRoom เมื่อโหลดหน้า
    initUsername()
    clearExpiredRoom();
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
        <button className="button-common btn-primary btn-block btn-lg" onClick={handleCreateRoom}>สร้างห้องใหม่</button>
      </div>
    </div>
  );
};

export default WelcomePage;
