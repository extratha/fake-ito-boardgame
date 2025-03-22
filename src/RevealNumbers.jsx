import { db } from "./firebase"; // Assuming your db is already initialized properly
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database"; // Import from firebase/database

const RevealNumbers = () => {

  const [revealNumbers, setRevealNumbers] = useState([]);

  useEffect(() => {
    const revealNumbersRef = ref(db, 'revealNumbers');

    const unsubscribe = onValue(revealNumbersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const revealNumbersData = Object.values(data);

        console.log("ก่อน sort:", revealNumbersData);

        setRevealNumbers(revealNumbersData);
      } else {
        setRevealNumbers([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const RevealedNumber = ({ data }) => <p style={{ margin: '0', fontSize: '16px', fontWeight: 500 }}>{data}</p>;

  return (
    <div style={{
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: "8px",
      left: '8px',
      top: '4rem',
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
            background: 'white',
            boxShadow: '1px 1px 4px 1px rgba(0,0,0,0.45)'
          }}>
            <RevealedNumber data={revealedData.userName} />
            <RevealedNumber data={revealedData.number} style={{color: `hsl(${200 - ((revealedData.number - 1) * 2)}, 100%, 40%)`}} />
          </div>
        ))}
    </div>
  );
};

export default RevealNumbers;
