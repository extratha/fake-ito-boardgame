import React, { useState, useRef, useEffect } from 'react';
import './RuleDetail.css';

const RuleDetail = () => {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef(null);

  const togglePopup = () => {
    setShowPopup(!showPopup);
  };

  // Close popup when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowPopup(false);
      }
    };

    // Adding event listener to detect click outside
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up the event listener when the component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const PLAY_STEPS =[
    "สุ่มหัวข้อที่จะเล่น หากคนใดกดปุ่มสุ่มหัวข้อ หัวข้อจะถูกสุ่มและห็นกันทุกคน โดยหากหัวข้อไหนสุ่มไปแล้ว จะไม่สามารถสุ่มเจอซ้ำอีก จนกว่าจะกดปุ่มเคลียร์หัวข้อที่เคยสุ่ม",
    "แต่ละคนกดสุ่มเลข 1-100 (แนะนำค่อย ๆ กดทีละคน ถ้ากดพร้อมกันอาจได้เลขซ้ำ) โดยทุกคนจะได้เลขที่ไม่ซ้ำกับตัวเองและเพื่อน และจะไม่มีใครรู้เลขของคนอื่น สามารถสุ่มได้สูงสุดคนละ 3 เลข ",
    "แต่ละคนจะเริ่มใบ้ความตามหัวข้อที่ทุกคนได้รับ ตามระดับเลขของตัวเอง เช่น หัวข้อ:สิ่งของที่ใหญ่ ใครได้เลข 1 อาจจะใบ้ว่าเม็ดเกลือ ใครได้เลข 100 อาจจะใบ้ว่า กาแล็กซี",
    "ตกลงว่าใครจะเปิดเผยตัวเลขก่อน โดยต้องเริ่มจากเลขน้อยไล่ไปเลขที่มากขึ้น ถ้าหากมีใครเปิดไพ่แล้ว อีกคนพบว่าไพ่ที่ตัวเองยังไม่เปิดมีเลขน้อยกว่า จะถือว่าลดหัวใจของทั้งกลุ่ม 1 ดวง ถ้ามีอีกคนพบเหมือนกัน ลดอีก 1 หัวใจ",
  ]

  return (
    <div className="rule-detail-container">
      <button className="rule-button" onClick={togglePopup}>
        Rules
      </button>
      {showPopup && (
        <div className="popup">
          <div ref={popupRef} className="popup-content">
            <h3 style={{ margin: '0' }}>วิธีเล่น</h3>
            {PLAY_STEPS.map((step, index)=> (
              <p>{`${index+1}. ${step}`}</p>
            ))}
            <p> หากหัวใจหมด เริ่มเกมใหม่</p>
            <p> จำนวนเลขที่แต่ละคนสุ่ม รอบแรกจะสุ่มคนละเลข หากจบเกมรอบแรกโดยหัวใจยังไม่หมด สามารถเริ่มรอบต่อไปโดยเพิ่มเลขที่สุ่มเป็นคนละสองเลข สามารถเพิ่มถึงสามเลขด้วยเงื่อนไขเดียวกัน </p>

            <button className="close-button" onClick={togglePopup}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleDetail;
