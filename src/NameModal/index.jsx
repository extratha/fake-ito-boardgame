import './NameModal.css'
import '../App.css'
import Cookies from 'js-cookie';


const NameModal = ({ userName, setUserName, setShowNameModal}) => {

  const handleSaveName = () => {
    setUserName(userName)

    if (userName.trim()) {
      Cookies.set('userName', userName.trim(), { expires: 7 });
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
        onChange={(e) => handleSaveName(e.target.value)}
        value={userName}
        placeholder="พิมพ์ชื่อที่นี่"
      />
      <button className='button-common' onClick={() => handleSaveName()}>ยืนยัน</button>
    </div>
  </div>)
}

export default NameModal
