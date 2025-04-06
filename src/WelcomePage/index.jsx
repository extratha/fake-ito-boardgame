import { getDatabase, push, ref, set, serverTimestamp, get, remove } from "firebase/database";
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
    <div style={{ width: "180px", padding: '3rem 1rem 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: 'auto', gap: '8px' }}>
      <p style={{fontWeight:600, fontSize: '24px'}}>Fake Ito Board Game</p>
      <p style={{ margin: 0 }}>ชื่อผู่เล่น:</p>
      <input
        value={userName}
        placeholder="ระบุชื่อผู้เล่น"
        onChange={handleUserNameChange}
      />
      <p style={{fontWeight:500, fontSize: '24px' , margin: "16px 0 0"}}>เข้าร่วมห้อง</p>
      
      <p style={{ margin: 0 }}>เลขที่ห้อง:</p>
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="รหัสห้อง"
      />
      <button className="button-common"  onClick={handleJoinRoom}>เข้าร่วมห้อง</button>
      <p style={{fontWeight:500, fontSize: '20px', margin: '2rem 0 0', textAlign:'center'}}>หรือ</p>
      <button className="button-common"  onClick={handleCreateRoom}>สร้างห้องใหม่</button>
    </div>
  );
};

export default WelcomePage;
