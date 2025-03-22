import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useState } from "react";

const RevealNumbers = () => {

  const [revealNumbers, setRevealNumbers] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'revealNumbers'), (snapshot) => {
      if (!snapshot.empty) {
        // ดึงข้อมูลทั้งหมดจาก Firestore
        const revealNumbersData = snapshot.docs.map(doc => doc.data());

        // ตั้งค่า revealNumbers ด้วยข้อมูลที่ได้รับจาก Firestore
        setRevealNumbers(revealNumbersData);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const RevealedNumber = ({ data }) => {
    return <p style={{ margin: '0', fontSize: '16px', fontWeight: 500 }}>{data}</p>
  }

  return (
    <div
      style={{
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: "8px",
        left: '8px',
        top: '4rem',
      }}
    >
      {
        // เรียงข้อมูลตาม timestamp ก่อนแสดงผล
        [...revealNumbers]
          .sort((a, b) => b.timestamp - a.timestamp)  // เรียงตาม timestamp
          .map((revealedData, index) => (
            <div
              key={index}
              style={{
                width: "80px",
                padding: "8px",
                borderRadius: "8px",
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'white',
                boxShadow: '1px 1px 4px 1px rgba(0,0,0,0.45)'
              }}
            >
              <RevealedNumber data={revealedData.userName} />
              <RevealedNumber data={revealedData.number} />

            </div>
          ))
      }
    </div>
  )
}

export default RevealNumbers;
