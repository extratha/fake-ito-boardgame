import { useEffect, useState } from 'react';
import { ref, onValue, onDisconnect, update, set, runTransaction, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { snapshotToList } from '../utils/roomData';

// ลงชื่อผู้เล่นในห้อง: online=true ตอนต่อติด และให้ server เปลี่ยนเป็น offline เองเมื่อหลุด (onDisconnect)
// enabled=false จนกว่าจะเช็กแล้วว่าห้องมีจริง กันการสร้างห้องผีจากลิงก์ผิด
export const useRoomPresence = ({ roomId, clientId, userName, enabled }) => {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rooms/${roomId}/players`), (snapshot) => {
      setPlayers(snapshotToList(snapshot));
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!enabled || !userName) return undefined;

    const playerRef = ref(db, `rooms/${roomId}/players/${clientId}`);
    const lastSeenRef = ref(db, `roomIndex/${roomId}/lastSeen`);

    const unsubscribe = onValue(ref(db, '.info/connected'), async (snapshot) => {
      if (snapshot.val() !== true) return;
      try {
        // ลงทะเบียน onDisconnect ก่อน แล้วค่อยประกาศว่าออนไลน์ (ถ้าหลุดระหว่างนี้ server จะ mark offline ให้)
        await onDisconnect(playerRef).update({ online: false, lastSeen: serverTimestamp() });
        await onDisconnect(lastSeenRef).set(serverTimestamp());
        await update(playerRef, { name: userName, online: true, lastSeen: serverTimestamp() });
        await runTransaction(ref(db, `rooms/${roomId}/players/${clientId}/joinedAt`), (current) => current ?? serverTimestamp());
        await set(lastSeenRef, serverTimestamp());
      } catch (error) {
        console.error('[db] register presence failed:', error);
      }
    });

    return () => {
      unsubscribe();
      // ออกจากห้องเอง (กดย้อนกลับ) ไม่ต้องรอ server จับว่าหลุด
      onDisconnect(playerRef).cancel().catch(() => {});
      onDisconnect(lastSeenRef).cancel().catch(() => {});
      update(playerRef, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
      set(lastSeenRef, serverTimestamp()).catch(() => {});
    };
  }, [roomId, clientId, userName, enabled]);

  return players;
};
