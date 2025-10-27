import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Brutalist from './pages/Brutalist';
import Warm from './pages/Warm';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Brutalist />} />
        <Route path="/brutalist" element={<Brutalist />} />
        <Route path="/warm" element={<Warm />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
