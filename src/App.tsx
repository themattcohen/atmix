import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Brutalist from './pages/Brutalist';
import Walkies from './pages/Walkies';
import WorkingTogether from './pages/WorkingTogether';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Brutalist />} />
        <Route path="/walkies" element={<Walkies />} />
        <Route path="/working-together" element={<WorkingTogether />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
