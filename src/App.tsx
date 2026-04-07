import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Brutalist from './pages/Brutalist';
import Walkies from './pages/Walkies';
import WorkingTogether from './pages/WorkingTogether';
import Projects from './pages/Projects';
import IV from './pages/IV';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Brutalist />} />
        <Route path="/walkies" element={<Walkies />} />
        <Route path="/working-together" element={<WorkingTogether />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/IV" element={<IV />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
