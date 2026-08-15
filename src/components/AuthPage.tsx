import { useState } from 'react';
import { User } from '../App';
import { Dumbbell } from 'lucide-react';

type AuthPageProps = {
  onLogin: (user: User) => void;
};

export function AuthPage({ onLogin }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock user data
    const mockUser: User = {
      id: '1',
      email: email || 'baza@tripleone.com',
      fullName: fullName || 'Youssef Baza',
      dateOfBirth: '2002-01-01',
      phone: '+1234567890',
      gender: 'Male',
      trainingGoal: 'Build muscle and improve fitness',
      healthInfo: 'None',
      injuryInfo: 'None',
      fitnessLevel: 'Intermediate',
      medicalNotes: '',
      emergencyContact: {
        name: 'Amr Baza',
        phone: '+1234567891',
        relationship: 'Father'
      },
      subscription: {
        expiryDate: '2025-12-31',
        sessionsBalance: 12
      },
      inbodyTracking: [
        {
          date: '2025-01-01',
          weight: 75,
          bodyFatPercentage: 18,
          muscleMass: 35,
          measurements: {
            chest: 95,
            waist: 80,
            hips: 90,
            arms: 32,
            thighs: 55
          }
        }
      ],
      progressPhotos: []
    };

    onLogin(mockUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ba181c] to-[#7b161b] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-[#ba181c] p-3 rounded-full">
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-center text-gray-900 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>TRIPLE ONE</h1>
        <p className="text-center text-gray-600 mb-8">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="fullName" className="block text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba181c]"
                placeholder="Enter your full name"
              />
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba181c]"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba181c]"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#ba181c] text-white py-3 rounded-lg hover:bg-[#7b161b] transition-colors"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[#ba181c] hover:text-[#7b161b]"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}