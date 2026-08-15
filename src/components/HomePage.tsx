import { User, Booking } from '../App';
import { Calendar, UserCircle, Activity, LogOut, Clock, TrendingUp, Bell } from 'lucide-react';
import { useState } from 'react';
import { sendPushToAdmin } from '../lib/pushNotifications';

type HomePageProps = {
  user: User;
  bookings: Booking[];
  onNavigate: (view: 'home' | 'booking' | 'profile' | 'workout') => void;
  onLogout: () => void;
};

export function HomePage({ user, bookings, onNavigate, onLogout }: HomePageProps) {
  const upcomingBookings = bookings.filter(b => b.status === 'confirmed').slice(0, 3);
  const [isAttending, setIsAttending] = useState(false);
  const [attendSuccess, setAttendSuccess] = useState(false);

  const handleAttend = async () => {
    setIsAttending(true);
    try {
      await sendPushToAdmin(
        'Member Check-In Alert',
        `${user.fullName} has just checked in at Triple One!`,
        { memberId: user.memberId, timestamp: new Date().toISOString() }
      );
      setAttendSuccess(true);
      setTimeout(() => setAttendSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to send notification:', error);
    } finally {
      setIsAttending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-[#ba181c]" style={{ fontFamily: 'Cinzel, serif' }}>TRIPLE ONE</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleAttend}
              disabled={isAttending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                attendSuccess 
                  ? 'bg-green-600 text-white' 
                  : 'bg-[#ba181c] text-white hover:bg-[#7b161b]'
              } disabled:opacity-50`}
            >
              <Bell className="w-5 h-5" />
              <span>{attendSuccess ? 'Checked In!' : isAttending ? 'Checking...' : 'Attend'}</span>
            </button>
            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2 text-gray-700 hover:text-[#ba181c] transition-colors"
            >
              <UserCircle className="w-5 h-5" />
              <span>Profile</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-gray-700 hover:text-[#ba181c] transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Book Session CTA - Now at the top */}
        <div className="bg-gradient-to-r from-[#ba181c] to-[#7b161b] rounded-2xl p-8 mb-8 text-white shadow-lg">
          <h2 className="mb-4">Book Your Next Session</h2>
          <p className="mb-6 opacity-90">
            Choose your preferred time, date, and coach to continue your fitness journey
          </p>
          <button
            onClick={() => onNavigate('booking')}
            className="bg-white text-[#ba181c] px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Book Session Now
          </button>
        </div>

        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-gray-900 mb-2">Welcome back, {user.fullName.split(' ')[0]}</h2>
          <p className="text-gray-600">Ready to crush your fitness goals?</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-700">Sessions Remaining</h3>
              <Calendar className="w-5 h-5 text-[#ba181c]" />
            </div>
            <p className="text-gray-900">{user.subscription.sessionsBalance}</p>
            <p className="text-gray-500 text-sm">Expires {new Date(user.subscription.expiryDate).toLocaleDateString()}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-700">Current Weight</h3>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-gray-900">{user.inbodyTracking[user.inbodyTracking.length - 1]?.weight || 0} kg</p>
            <p className="text-gray-500 text-sm">
              Body Fat: {user.inbodyTracking[user.inbodyTracking.length - 1]?.bodyFatPercentage || 0}%
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-700">Upcoming Sessions</h3>
              <Clock className="w-5 h-5 text-[#7b161b]" />
            </div>
            <p className="text-gray-900">{upcomingBookings.length}</p>
            <p className="text-gray-500 text-sm">Next: {upcomingBookings[0]?.date || 'None scheduled'}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => onNavigate('workout')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-[#ba181c] transition-colors text-left"
          >
            <Activity className="w-8 h-8 text-[#ba181c] mb-3" />
            <h3 className="text-gray-900 mb-2">Workout & Progress</h3>
            <p className="text-gray-600">Track your workouts, log progress, and view your stats</p>
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-[#ba181c] transition-colors text-left"
          >
            <UserCircle className="w-8 h-8 text-[#7b161b] mb-3" />
            <h3 className="text-gray-900 mb-2">My Profile</h3>
            <p className="text-gray-600">Update your information, goals, and measurements</p>
          </button>
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-gray-900 mb-4">Upcoming Sessions</h3>
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-gray-900">{booking.coachName}</p>
                    <p className="text-gray-600 text-sm">
                      {booking.date} at {booking.time}
                    </p>
                  </div>
                  <span className="text-green-600 text-sm">Confirmed</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}