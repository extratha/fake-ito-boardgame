import { useEffect, useState } from 'react';
import { ref, onValue, runTransaction, set } from 'firebase/database';
import { db } from '../firebase';
import { pickHostCandidate } from '../utils/roomData';

// รอให้ host ที่แค่รีเฟรช/เน็ตกระตุกกลับมาก่อน ค่อยโอน host
export const HOST_GRACE_MS = 5000;

export const useHost = ({ roomPath, clientId, userName, players }) => {
  const [hostId, setHostId] = useState(null);
  const [hostName, setHostName] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsubscribeId = onValue(ref(db, `${roomPath}/hostId`), (snapshot) => {
      setHostId(snapshot.val());
      setIsLoaded(true);
    });
    const unsubscribeName = onValue(ref(db, `${roomPath}/host`), (snapshot) => {
      setHostName(snapshot.val() || '');
    });
    return () => {
      unsubscribeId();
      unsubscribeName();
    };
  }, [roomPath]);

  useEffect(() => {
    if (!isLoaded || !userName) return undefined;
    const isOnline = (id) => players.some((p) => p.id === id && p.online === true);
    if (!isOnline(clientId)) return undefined;
    if (hostId && isOnline(hostId)) return undefined;

    let delay;
    if (!hostId && hostName === userName) {
      delay = 0; // ห้องเก่าที่ยังเก็บ host เป็นชื่อ: เจ้าของชื่อรับ hostId ไปเลย
    } else if (pickHostCandidate(players)?.id === clientId) {
      delay = HOST_GRACE_MS;
    } else {
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        // compare-and-set: ถ้ามีคนรับ host ไปก่อนแล้ว transaction จะไม่ commit
        const result = await runTransaction(ref(db, `${roomPath}/hostId`), (current) =>
          (current ?? null) === (hostId ?? null) ? clientId : undefined);
        if (result.committed) {
          await set(ref(db, `${roomPath}/host`), userName);
          console.info('[room] you are now the host');
        }
      } catch (error) {
        console.error('[db] claim host failed:', error);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [isLoaded, players, hostId, hostName, clientId, userName, roomPath]);

  const displayName = players.find((p) => p.id === hostId)?.name || hostName;
  return { hostId, hostName: displayName, isHost: Boolean(hostId) && hostId === clientId };
};
