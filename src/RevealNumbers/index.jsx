import { db } from "../firebase"; // Assuming your db is already initialized properly
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database"; // Import from firebase/database

const RevealNumbers = ({ roomId }) => {

  const [revealNumbers, setRevealNumbers] = useState([]);

  useEffect(() => {
    const revealNumbersRef = ref(db, `rooms/${roomId}/revealNumbers`);

    const unsubscribe = onValue(revealNumbersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const revealNumbersData = Object.values(data);

        setRevealNumbers(revealNumbersData);
      } else {
        setRevealNumbers([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const RevealedNumber = ({ data, styles }) => <p style={{ margin: '0', fontSize: '16px', fontWeight: 500, ...styles }}>{data}</p>;

  return (
    <div style={{
      minWidth: "100px",
      height: '82vh',
      padding: "6px",
      overflow: 'auto',
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: "8px",
      left: '8px',
      top: '3rem',
    }}>
      {revealNumbers
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map((revealedData, index) => (
          <div key={index} style={{
            width: "80px",
            padding: "8px",
            borderRadius: "8px",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            background: "rgb(44, 44, 44)",
            boxShadow: "2px 2px 5px rgb(0, 0, 0)",
            padding: "8px 12px",
            display: "inline-block",
          }}>
            <RevealedNumber data={revealedData.userName} />
            <RevealedNumber data={revealedData.number} styles={{ color: `hsl(${200 - ((revealedData.number - 1) * 2)}, 100%, 40%)` }} />
          </div>
        ))}
    </div>
  );
};

export default RevealNumbers;
