import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';
import { withTimeout } from './connection';

export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000; // ห้องที่ไม่มีใครออนไลน์เกิน 10 นาที
export const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000; // ห้องอายุเกิน 1 วัน

const deleteRoom = async (roomId, reason) => {
  console.log(`[cleanup] deleting room ${roomId}: ${reason}`);
  await withTimeout(update(ref(db), {
    [`rooms/${roomId}`]: null,
    [`roomIndex/${roomId}`]: null,
    [`hands/${roomId}`]: null,
  }), 'delete room');
};

// ไม่มี server ไว้ตั้งเวลาลบ จึงลบตอนมีคนเปิดหน้าเว็บ โดยอ่านแค่ roomIndex (เล็กมาก)
// เงื่อนไขต้องตรงกับ database.rules.json (rules ยอมให้ลบเฉพาะห้องที่หมดอายุตามนี้)
export const cleanupRooms = async (now = Date.now()) => {
  try {
    const snapshot = await withTimeout(get(ref(db, 'roomIndex')), 'load room index');
    const index = snapshot.val() || {};
    for (const [roomId, info] of Object.entries(index)) {
      const createdAt = info?.createdAt;
      const lastSeen = info?.lastSeen;
      const hasOnlinePlayer = Object.keys(info?.online || {}).length > 0;
      try {
        if (typeof createdAt === 'number' && now - createdAt > ROOM_MAX_AGE_MS) {
          await deleteRoom(roomId, 'older than 1 day');
        } else if (typeof lastSeen === 'number' && now - lastSeen > EMPTY_ROOM_TTL_MS && !hasOnlinePlayer) {
          await deleteRoom(roomId, 'empty for more than 10 minutes');
        }
      } catch (error) {
        // ห้องเดียวลบไม่ได้ (เช่น มีคนเพิ่งกลับเข้ามา rules ไม่ยอม) ไม่ต้องหยุดห้องอื่น
        console.error(`[cleanup] delete room ${roomId} failed:`, error);
      }
    }
  } catch (error) {
    console.error('[cleanup] failed:', error);
  }
};
