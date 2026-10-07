import './NameModal.css'
import '../App.css'
import Cookies from 'js-cookie';
import { useState } from 'react';
import { showAlert } from '../Dialog/dialogStore';


const NameModal = ({ userName, setUserName, setShowNameModal}) => {
  const [tmpUserName, setTmpUserName] = useState('')

  const handleSaveName = () => {
    setUserName(tmpUserName)

    if (tmpUserName.trim()) {
      Cookies.set('userName', tmpUserName.trim(), { expires: 7 });
      setShowNameModal(false);
    } else {
      showAlert('ชื่อห้ามว่างนะนายจ๋า');
    }
  }

  return (<div className="modal-overlay">
    <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="name-modal-title">
      <h3 id="name-modal-title">กรุณากรอกชื่อของคุณ</h3>
      <input
        className="text-input"
        autoFocus
        type="text"
        onChange={(e)=>setTmpUserName(e?.target?.value)}
        value={tmpUserName}
        placeholder="พิมพ์ชื่อที่นี่"
      />
      <button className='button-common btn-primary btn-lg' onClick={() => handleSaveName()}>ยืนยัน</button>
    </div>
  </div>)
}

export default NameModal
