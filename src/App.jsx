import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, addDoc, deleteDoc, doc, onSnapshot } from './firebase';
import topic from './topic.json';
import HeartDisplay from './heart';
import RevealNumbers from './RevealNumbers';
import Cookies from 'js-cookie'; 

const maxNumber = 100;

function App() {
  const [userName, setUserName] = useState('');
  const [myNumbers, setMyNumbers] = useState([]);
  const [usedNumbers, setUsedNumbers] = useState([]); // เก็บเลขที่ใช้ไปแล้ว
  const [isLoading, setIsLoading] = useState(false);
  const [heart, setHeart] = useState(3);

  const [currentTopic, setCurrentTopic] = useState('');

  useEffect(() => {
    // ลองโหลดชื่อจาก cookies ถ้ามี
    const savedUserName = Cookies.get('userName');
    if (savedUserName) {
      setUserName(savedUserName);
    }
  }, []);

  const handleUserNameChange = (event) => {
    setUserName(event.target.value);
    Cookies.set('userName', event.target.value, { expires: 7 });
  };

  const fetchUsedNumbers = async () => {
    setIsLoading(true);
    const querySnapshot = await getDocs(collection(db, 'numbers'));
    let numbers = [];
    querySnapshot.forEach((doc) => {
      numbers.push(doc.data().number); // เอาค่า number จากแต่ละ document
    });
    setUsedNumbers(numbers);
    setIsLoading(false);
  };

  // Real-time listener for currentTopic using onSnapshot
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'topic'), (snapshot) => {
      if (!snapshot.empty) {
        const topicData = snapshot.docs[0].data();
        setCurrentTopic(topicData.topic); // Update currentTopic with real-time data
      }
    });

    return () => {
      unsubscribe(); // Cleanup the listener when the component unmounts
    };
  }, []);

  useEffect(() => {
    // Subscribe to real-time updates for the 'heart' collection
    const unsubscribe = onSnapshot(collection(db, 'heart'), (snapshot) => {
      // เมื่อข้อมูลใน collection 'heart' เปลี่ยนแปลง
      snapshot.forEach((doc) => {
        const heartData = doc.data();
        setHeart(heartData.heart); // อัปเดตค่า heart ใน state
      });
    });

    // Unsubscribe when component is unmounted
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchUsedNumbers();
  }, []);

  const generateRandomNumber = async () => {
    await fetchUsedNumbers();
    if (usedNumbers.length === maxNumber) {
      alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
      return;
    }

    let randomNumber;

    // สุ่มเลขที่ยังไม่เคยใช้ (ไม่ซ้ำกัน)
    do {
      randomNumber = Math.floor(Math.random() * maxNumber) + 1; // เปลี่ยนเป็น 1-100
    } while (usedNumbers.includes(randomNumber));

    setMyNumbers((prevNumbers) => [...prevNumbers, randomNumber]);

    // เพิ่มเลขที่สุ่มได้เข้าไปใน Firestore เพื่อบันทึกว่าใช้ไปแล้ว
    try {
      await addDoc(collection(db, 'numbers'), {
        number: randomNumber,  // เก็บเลขที่สุ่มได้
        timestamp: new Date(),  // เก็บเวลา
      });
      setUsedNumbers([...usedNumbers, randomNumber]); // เพิ่มเลขที่สุ่มได้ไปยัง array ของเลขที่ใช้แล้ว
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  };

  const generateNextNumber = async () => {
    await fetchUsedNumbers();
    if (myNumbers.length >= 3) {
      alert('คุณสุ่มเลขครบแล้ว');
      return;
    }
    if (usedNumbers.length === maxNumber) {
      alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
      return;
    }

    let randomNumber;

    // สุ่มเลขที่ยังไม่เคยใช้ (ไม่ซ้ำกัน)
    do {
      randomNumber = Math.floor(Math.random() * maxNumber) + 1;
    } while (usedNumbers.includes(randomNumber));

    setMyNumbers((prevNumbers) => [...prevNumbers, randomNumber]);

    // เพิ่มเลขที่สุ่มได้เข้าไปใน Firestore
    try {
      await addDoc(collection(db, 'numbers'), {
        number: randomNumber,
        timestamp: new Date(),
      });
      setUsedNumbers([...usedNumbers, randomNumber]);
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  };

  const clearUsedNumbers = async () => {
    /* eslint-disable no-restricted-globals */
    if (confirm('ยืนยันจะเคลียร์ที่ทุกคนสุ่มไปแล้วไหม')) {
      setIsLoading(true);
      const querySnapshot = await getDocs(collection(db, 'numbers'));
      querySnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref); // ลบทุก document ใน collection
      });
      setUsedNumbers([]); // เคลียร์เลขที่ใช้ไปแล้วใน state
      setMyNumbers([]);
      setIsLoading(false);

      alert('เคลียร์เลขที่ใช้ไปแล้วเรียบร้อย!');
    }
  };

  const clearMyNumbers = async () => {
    if (confirm('คุณต้องการเคลียร์เลขที่เคยสุ่มไปแล้วใช่หรือไม่?')) {
      setIsLoading(true);

      // ดึงข้อมูลเลขทั้งหมดจาก Firestore
      const querySnapshot = await getDocs(collection(db, 'numbers'));

      querySnapshot.forEach(async (doc) => {
        const numberData = doc.data().number;

        // ถ้าเลขนั้นมีอยู่ใน myNumbers, ลบจาก Firestore
        if (myNumbers.includes(numberData)) {
          await deleteDoc(doc.ref);
        }
      });

      // เคลียร์เลขที่เก็บไว้ใน state
      setMyNumbers([]);
      setIsLoading(false);
      alert('เคลียร์เลขที่สุ่มไปแล้วเรียบร้อย!');
    }
  };

  const handleRandomTopic = async () => {
    if (confirm('สุ่มหัวข้อใหม่เท่ากับเริ่มเกมใหม่ ยืนยันหรือไม่')) {
      setIsLoading(true);

      await resetGameData();

      // สุ่มหัวข้อใหม่จากไฟล์ JSON
      const randomTopic = topic.data[Math.floor(Math.random() * topic.data.length)];

      // ตรวจสอบว่า Firestore มีหัวข้อแล้วหรือไม่
      const topicSnapshot = await getDocs(collection(db, 'topic'));

      if (!topicSnapshot.empty) {
        // ถ้ามีหัวข้อแล้ว ลบหัวข้อเดิมทิ้ง
        topicSnapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);  // ลบ document ที่มีอยู่
        });
      }

      // เพิ่มหัวข้อใหม่ลงใน Firestore
      try {
        await addDoc(collection(db, 'topic'), {
          topic: randomTopic,  // เก็บหัวข้อที่สุ่มได้
          timestamp: new Date(),  // เก็บเวลา
        });
        setCurrentTopic(randomTopic);  // ตั้งค่าหัวข้อที่สุ่มได้ให้กับ state
      } catch (e) {
        console.error('Error adding topic to Firestore: ', e);
      }

      setIsLoading(false);
    }
  };

  const resetGameData = async () => {
    try {
      setMyNumbers([]);
      setUsedNumbers([]);

      const numbersSnapshot = await getDocs(collection(db, 'numbers'));
      numbersSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);  // ลบเลขที่ใช้ไปแล้ว
      });

      const revealNumbersSnapshot = await getDocs(collection(db, 'revealNumbers'));
      revealNumbersSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);  // ลบข้อมูลใน revealNumbers
      });

      await fetchUsedNumbers(); // เคลียร์เลขที่ใช้ไปแล้วใน state

    } catch (e) {
      console.error('Error resetting game data: ', e);
    }
  };

  const handleClickNumber = async (number) => {
    // ดึงข้อมูลทั้งหมดจาก Firestore
    const revealNumbersSnapshot = await getDocs(collection(db, 'revealNumbers'));
    
    // ตรวจสอบว่าเลขนี้มีอยู่ใน revealNumbers หรือไม่
    const isNumberRevealed = revealNumbersSnapshot.docs.some(doc => doc.data().number === number);
    
    if (isNumberRevealed) {
      // ถ้าเลขนี้เคยถูกเปิดเผยแล้ว, ไม่ทำอะไร
      alert('เลขนี้เคยถูกเปิดเผยแล้ว');
      return;
    }
  
    // ถ้าไม่ได้เคยเปิดเผย, ให้แสดง confirm และเพิ่มข้อมูลลง Firestore
    if (confirm('เปิดเผยเลขของคุณให้สังคมรับรู้')) {
      await addDoc(collection(db, 'revealNumbers'), {
        number,
        userName,
        timestamp: new Date(),
      });
    }
  }

  const handleResetHeart = () => {
    updateHeart(3);
  };

  const handleReduceHeart = () => {
    if (heart > 0) {
      updateHeart(heart - 1);
    }
  };

  const updateHeart = async (newHeart) => {
    setHeart(newHeart); // อัปเดตค่า heart ใน state

    // ตรวจสอบว่า Firestore มีค่า heart หรือไม่
    const heartSnapshot = await getDocs(collection(db, 'heart'));

    if (!heartSnapshot.empty) {
      // ถ้ามีอยู่แล้ว ให้ลบค่าก่อนแล้วเพิ่มใหม่
      heartSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    }

    // เพิ่มค่าใหม่ลง Firestore
    await addDoc(collection(db, 'heart'), {
      heart: newHeart,
      timestamp: new Date(),
    });
  };

  return (
    <div className="App">
      <div className='wrapper'>
        {isLoading ?
          <h3> ...LOADING...</h3>
          :
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <input
              value={userName}
              placeholder="กรอกชื่อ"
              onChange={handleUserNameChange} 
            />
            <div style={{ width: "100%", display: 'flex', flexDirection: 'column', gap: "8px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={handleRandomTopic}>สุ่มหัวข้อ</button>
              </div>

              <div style={{ display: "flex", flexDirection: "row", gap: '8px', alignItems: 'center' }}>
                <p style={{ margin: "0", fontSize: '22px', fontWeight: '500' }}> หัวข้อ: </p>
                <h2 style={{ margin: "0" }}> {currentTopic}</h2>
              </div>
            </div>

            <div style={{ width: "100%", display: 'flex', flexDirection: 'column', gap: "16px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
              <h2 style={{ margin: "8px" }}>สุ่มเลข 1-{maxNumber}</h2>

              <button style={{ width: "120px" }} disabled={myNumbers.length >= 1} onClick={generateRandomNumber}>สุ่มเลข</button>
              {myNumbers.length > 0 && myNumbers.length < 3 && <button onClick={generateNextNumber}>สุ่มอีกเลข</button>}

              {myNumbers &&
                <div style={{ display: 'flex', flexDirection: "column", gap: "16px", alignItems: 'center' }}>
                  <h1 style={{ margin: "16px 0 0", color: myNumbers.length > 0 ? 'default' : 'transparent' }}>เลขที่ออก</h1>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    {myNumbers.map((value) => (
                      <h1
                        onClick={()=>handleClickNumber(value)}
                        style={{ margin: '0 0 16px', cursor:'pointer', color: `hsl(${200 - ((value - 1) * 2)}, 100%, 40%)`  }} >
                        {value}
                      </h1>
                    ))}
                  </div>
                </div>
              }

              <button onClick={clearMyNumbers}>เคลียร์เลขของตัวเอง</button>
              <button onClick={clearUsedNumbers}>เคลียร์เลขทุกคน</button>
            </div>

            <HeartDisplay heart={heart} setHeart={setHeart} handleReduceHeart={handleReduceHeart} handleResetHeart={handleResetHeart} />
            <RevealNumbers/>
          </div>
        }
      </div>
    </div>
  );
}

export default App;
