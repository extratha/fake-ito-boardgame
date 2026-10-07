import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { showAlert } from '../Dialog/dialogStore';

// ถ้าต่อ server ไม่ได้ Firebase SDK จะเก็บคำสั่งไว้ในคิวและรอไปเรื่อย ๆ โดยไม่ throw
// จึงต้องใส่ timeout เองเพื่อให้ผู้เล่นรู้ว่ามีปัญหา
export const DB_TIMEOUT_MS = 8000;
export const UNREACHABLE_AFTER_MS = 10000;

export class DbTimeoutError extends Error {
  constructor(action, ms) {
    super(`${action} timed out after ${ms}ms (database unreachable?)`);
    this.name = 'DbTimeoutError';
  }
}

export const withTimeout = (promise, action = 'database operation', ms = DB_TIMEOUT_MS) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DbTimeoutError(action, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const reportDbError = (error, action) => {
  console.error(`[db] ${action} failed:`, error);
  if (error instanceof DbTimeoutError) {
    showAlert('เชื่อมต่อฐานข้อมูลไม่ได้ ลองรีเฟรชหน้าแล้วกดใหม่อีกครั้ง', { title: 'เชื่อมต่อไม่ได้' });
  }
};

// 'connecting' | 'connected' | 'disconnected' (เคยต่อได้แล้วหลุด) | 'unreachable' (ต่อไม่ได้เลยเกินเวลา)
export const useConnectionStatus = () => {
  const [status, setStatus] = useState('connecting');
  const hasConnected = useRef(false);

  useEffect(() => {
    const unreachableTimer = setTimeout(() => {
      if (!hasConnected.current) {
        console.warn(`[db] cannot reach Realtime Database after ${UNREACHABLE_AFTER_MS}ms`);
        setStatus('unreachable');
      }
    }, UNREACHABLE_AFTER_MS);

    const unsubscribe = onValue(ref(db, '.info/connected'), (snapshot) => {
      if (snapshot.val() === true) {
        if (!hasConnected.current) console.info('[db] connected');
        else console.info('[db] reconnected');
        hasConnected.current = true;
        setStatus('connected');
      } else if (hasConnected.current) {
        console.warn('[db] connection lost, retrying...');
        setStatus('disconnected');
      }
    });

    return () => {
      clearTimeout(unreachableTimer);
      unsubscribe();
    };
  }, []);

  return status;
};
