import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from './MainPage';
import WelcomePage from './WelcomePage';
import ConnectionStatus from './ConnectionStatus';
import DialogHost from './Dialog';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/room/:roomId" element={<MainPage />} />
      </Routes>
      <ConnectionStatus />
      <DialogHost />
    </Router>
  );
}

export default App;