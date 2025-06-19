import { useState } from 'react'
import './App.css'
import LoginForm from './components/LoginForm'
import RegistrationForm from './components/RegistrationForm'

function App() {
  const [currentForm, setCurrentForm] = useState<'login' | 'register'>('login')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex justify-center pt-8 pb-4">
        <div className="flex bg-white rounded-lg p-1 shadow-sm border">
          <button 
            onClick={() => setCurrentForm('login')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentForm === 'login' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Login
          </button>
          <button 
            onClick={() => setCurrentForm('register')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentForm === 'register' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Register
          </button>
        </div>
      </div>
      
      {currentForm === 'login' ? <LoginForm /> : <RegistrationForm />}
    </div>
  )
}

export default App
