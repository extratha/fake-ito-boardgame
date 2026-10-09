import { useEffect, useState } from 'react';
import { ensureSignedIn } from '../firebase';

// รอ sign-in แบบ anonymous ให้เสร็จก่อน render หน้า (ทุกการอ่าน/เขียน DB ต้องมี auth.uid)
const AuthGate = ({ children }) => {
  const [status, setStatus] = useState('pending'); // 'pending' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('pending');
    ensureSignedIn()
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((error) => {
        // auth/operation-not-allowed = ยังไม่ได้เปิด Anonymous ใน Firebase Console
        console.error('[auth] anonymous sign-in failed:', error);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [attempt]);

  if (status === 'ready') return children;

  return (
    <div className="wrapper">
      {status === 'pending'
        ? <h3 className="loading">กำลังเข้าสู่ระบบ...</h3>
        : (
          <section className="card">
            <h2 className="card-title">เข้าสู่ระบบไม่สำเร็จ</h2>
            <p className="hint">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง</p>
            <button className="button-common btn-primary" onClick={() => setAttempt((n) => n + 1)}>ลองใหม่</button>
          </section>
        )}
    </div>
  );
};

export default AuthGate;
