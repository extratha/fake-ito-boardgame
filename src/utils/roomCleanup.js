import { ref, get, update } from 'firebase/database';
import { db, databaseURL } from '../firebase';
import { withTimeout } from './connection';

export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000; // ห้องที่ไม่มีใครออนไลน์เกิน 10 นาที
export const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000; // ห้องอายุเกิน 1 วัน

const deleteRoom = async (roomId, reason) => {
  console.log(`[cleanup] deleting room ${roomId}: ${reason}`);
  await withTimeout(update(ref(db), { [`rooms/${roomId}`]: null, [`roomIndex/${roomId}`]: null }), 'delete room');
};

const hasOnlinePlayer = async (roomId) => {
  const snapshot = await withTimeout(get(ref(db, `rooms/${roomId}/players`)), 'load players');
  return Object.values(snapshot.val() || {}).some((p) => p.online === true);
};

// ห้องเก่าก่อนมี roomIndex: ดึงแค่รายชื่อ key (shallow) ไม่โหลดข้อมูลทั้งห้อง
const cleanupLegacyRooms = async (indexedIds, now) => {
  if (!databaseURL || typeof fetch !== 'function') return;
  const response = await fetch(`${databaseURL}/rooms.json?shallow=true`);
  if (!response.ok) return;
  const roomIds = Object.keys((await response.json()) || {}).filter((id) => !indexedIds.has(id));
  for (const roomId of roomIds) {
    const snapshot = await withTimeout(get(ref(db, `rooms/${roomId}/createdAt`)), 'load createdAt');
    const createdAt = snapshot.val();
    if (typeof createdAt === 'number' && now - createdAt > ROOM_MAX_AGE_MS) {
      await deleteRoom(roomId, 'legacy room older than 1 day');
    }
  }
};

// ไม่มี server ไว้ตั้งเวลาลบ จึงลบตอนมีคนเปิดหน้าเว็บ โดยอ่านแค่ roomIndex (เล็กมาก)
export const cleanupRooms = async (now = Date.now()) => {
  try {
    const snapshot = await withTimeout(get(ref(db, 'roomIndex')), 'load room index');
    const index = snapshot.val() || {};
    for (const [roomId, info] of Object.entries(index)) {
      const createdAt = info?.createdAt;
      const lastSeen = info?.lastSeen ?? createdAt;
      if (typeof createdAt === 'number' && now - createdAt > ROOM_MAX_AGE_MS) {
        await deleteRoom(roomId, 'older than 1 day');
      } else if (typeof lastSeen === 'number' && now - lastSeen > EMPTY_ROOM_TTL_MS && !(await hasOnlinePlayer(roomId))) {
        await deleteRoom(roomId, 'empty for more than 10 minutes');
      }
    }
    await cleanupLegacyRooms(new Set(Object.keys(index)), now);
  } catch (error) {
    console.error('[cleanup] failed:', error);
  }
};
