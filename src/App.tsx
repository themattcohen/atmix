import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Brutalist from './pages/Brutalist';
import Walkies from './pages/Walkies';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Brutalist />} />
        <Route path="/brutalist" element={<Brutalist />} />
        <Route path="/walkies" element={<Walkies />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
