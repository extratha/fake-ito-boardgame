import { useEffect, useState } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../firebase';
import { withTimeout } from '../utils/connection';

// รายชื่อห้องที่มีคนออนไลน์ อ่านจาก roomIndex อย่างเดียว (ไม่โหลดข้อมูลเกม/แชทของห้อง)
export const toOnlineRooms = (index) =>
  Object.entries(index || {})
    .map(([roomId, info]) => ({
      roomId,
      hostName: info?.hostName || '',
      players: Object.values(info?.online || {}),
      lastSeen: info?.lastSeen ?? 0,
    }))
    .filter((room) => room.players.length > 0)
    .sort((a, b) => b.players.length - a.players.length || b.lastSeen - a.lastSeen);

// refreshToken เปลี่ยน = ดึงจาก server ใหม่อีกรอบ (นอกเหนือจาก listener realtime)
const OnlineRooms = ({ onJoin, refreshToken }) => {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'roomIndex'), (snapshot) => setRooms(toOnlineRooms(snapshot.val())));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!refreshToken) return;
    withTimeout(get(ref(db, 'roomIndex')), 'refresh online rooms')
      .then((snapshot) => setRooms(toOnlineRooms(snapshot.val())))
      .catch((error) => console.error('[db] refresh online rooms failed:', error));
  }, [refreshToken]);

  return (
    <section className="card">
      <h2 className="card-title">ห้องที่เล่นอยู่ตอนนี้</h2>
      {rooms.length === 0
        ? <p className="hint">ยังไม่มีห้องที่มีคนออนไลน์ สร้างห้องใหม่ได้เลย</p>
        : (
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.roomId} className="room-item">
                <div className="room-item-info">
                  <span className="room-item-id">{room.roomId}</span>
                  <span className="room-item-meta">
                    {room.hostName && `host: ${room.hostName} · `}{room.players.length} คน
                  </span>
                </div>
                <button
                  className="button-common btn-secondary"
                  onClick={() => onJoin(room.roomId)}
                  aria-label={`เข้าห้อง ${room.roomId}`}
                >
                  เข้า
                </button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
};

export default OnlineRooms;
