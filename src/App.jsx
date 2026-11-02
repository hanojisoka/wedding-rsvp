
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import RSVPPage from './pages/RSVPPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'

import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/rsvp/:token" element={<RSVPPage />} />

        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="/admin/login" element={<AdminLogin />} />

        <Route
          path="/"
          element={
            <div className="app">
              <h1>Wedding RSVP</h1>
              <p>Welcome to our wedding invitation!</p>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
