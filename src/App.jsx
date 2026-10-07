import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from './MainPage';
import WelcomePage from './WelcomePage';
import ConnectionStatus from './ConnectionStatus';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/room/:roomId" element={<MainPage />} />
      </Routes>
      <ConnectionStatus />
    </Router>
  );
}

export default App;