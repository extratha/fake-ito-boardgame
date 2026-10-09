import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './MainPage';
import WelcomePage from './WelcomePage';
import ConnectionStatus from './ConnectionStatus';
import DialogHost from './Dialog';
import AuthGate from './AuthGate';

function App() {
  return (
    <Router>
      <AuthGate>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/room/:roomId" element={<MainPage />} />
          {/* path ที่ไม่มีอยู่จริง (เช่น ลิงก์เก่า) กลับหน้าแรก แทนที่จะเป็นหน้าว่าง */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
      <ConnectionStatus />
      <DialogHost />
    </Router>
  );
}

export default App;
