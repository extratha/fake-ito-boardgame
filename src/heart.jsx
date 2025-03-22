import { useState, useEffect } from 'react';
import { getDatabase, ref, set, onValue } from 'firebase/database';

const HeartDisplay = ({ isLoading }) => {
  const [heart, setHeart] = useState(3); // เริ่มต้นที่ 3 หัวใจ
  const db = getDatabase();

  // ใช้ onValue เพื่อติดตามการเปลี่ยนแปลงใน Realtime Database
  useEffect(() => {
    const heartRef = ref(db, 'heart');
    const unsubscribe = onValue(heartRef, (snapshot) => {
      if (snapshot.exists()) {
        const heartData = snapshot.val();
        setHeart(heartData.heart);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [db]);

  // ฟังก์ชันลดหัวใจ
  const handleReduceHeart = () => {
    if (heart > 0) {
      const newHeart = heart - 1;
      const heartRef = ref(db, 'heart');
      set(heartRef, { heart: newHeart });
    }
  };

  // ฟังก์ชันรีเซ็ตหัวใจ
  const handleResetHeart = () => {
    const heartRef = ref(db, 'heart');
    set(heartRef, { heart: 3 });
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ margin: '1rem 0 0.5rem', display: 'flex', gap: '8px' }}>
          {isLoading ? (
            <h3>...fetch หัวใจ...</h3>
          ) : (
            <>
              {[...Array(3)].map((_, index) => (
                <svg
                  key={index}
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill={index < 3 - heart ? 'gray' : 'red'}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ))}
            </>
          )}
        </div>
        <button onClick={handleReduceHeart} disabled={heart < 1}>ลด 1 หัวใจ</button>
        <button style={{ marginTop: '2rem' }} onClick={handleResetHeart}>รีหัวใจ</button>
      </div>
    </div>
  );
};

export default HeartDisplay;
