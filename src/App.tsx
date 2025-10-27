import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Brutalist from './pages/Brutalist';
import Warm from './pages/Warm';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/warm" replace />} />
        <Route path="/brutalist" element={<Brutalist />} />
        <Route path="/warm" element={<Warm />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
