import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Brutalist from './pages/Brutalist';
import Walkies from './pages/Walkies';
import WorkingTogether from './pages/WorkingTogether';
import Projects from './pages/Projects';
import IV from './pages/IV';
import USMobileLabs from './pages/USMobileLabs';
import USMobileLabsV2 from './pages/USMobileLabsV2';
import USMobileLabsV3 from './pages/USMobileLabsV3';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Brutalist />} />
        <Route path="/walkies" element={<Walkies />} />
        <Route path="/working-together" element={<WorkingTogether />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/IV" element={<IV />} />
        <Route path="/usml" element={<USMobileLabs />} />
        <Route path="/usml-v2" element={<USMobileLabsV2 />} />
        <Route path="/usml-v3" element={<USMobileLabsV3 />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
