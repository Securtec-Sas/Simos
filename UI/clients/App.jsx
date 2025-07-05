import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import Top20 from './pages/Top20'
import Datos from './pages/Datos'
import './App.css'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/top20" element={<Top20 />} />
            <Route path="/datos" element={<Datos />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
