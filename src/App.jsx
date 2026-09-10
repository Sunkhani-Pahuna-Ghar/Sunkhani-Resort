import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Stay from './pages/Stay';
import Farm from './pages/Farm';
import Culture from './pages/Culture';
import Seminar from './pages/Seminar';
import Explore from './pages/Explore';
import Gallery from './pages/Gallery';
import BookNow from './pages/BookNow';
import Contact from './pages/Contact';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/stay" element={<Stay />} />
          <Route path="/farm" element={<Farm />} />
          <Route path="/culture" element={<Culture />} />
          <Route path="/seminar" element={<Seminar />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/book" element={<BookNow />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
