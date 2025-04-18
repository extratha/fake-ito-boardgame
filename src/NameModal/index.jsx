import './NameModal.css'
import '../App.css'
import Cookies from 'js-cookie';
import { useState } from 'react';


const NameModal = ({ userName, setUserName, setShowNameModal}) => {
  const [tmpUserName, setTmpUserName] = useState()

  const handleSaveName = () => {
    setUserName(tmpUserName)

    if (tmpUserName.trim()) {
      Cookies.set('userName', tmpUserName.trim(), { expires: 7 });
      setShowNameModal(false);
    } else {
      alert('ชื่อห้ามว่างนะนายจ๋า');
    }
  }

  return (<div className="modal-overlay">
    <div className="modal-content">
      <h3 style={{color:"rgba(0, 0, 0, 0.68)"}}>กรุณากรอกชื่อของคุณ</h3>
      <input
        type="text"
        onChange={(e)=>setTmpUserName(e?.target?.value)}
        value={tmpUserName}
        placeholder="พิมพ์ชื่อที่นี่"
      />
      <button className='button-common' onClick={() => handleSaveName()}>ยืนยัน</button>
    </div>
  </div>)
}

export default NameModal
