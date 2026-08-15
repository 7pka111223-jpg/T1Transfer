import { useState } from 'react';
import { ArrowLeft, User as UserIcon, Heart, Target, Phone, Calendar, Camera, TrendingUp } from 'lucide-react';
import type { User } from '@/types';

type ProfilePageProps = {
  user: User;
  onBack: () => void;
  onUpdateUser: (user: User) => void;
};

export function ProfilePage({ user, onBack, onUpdateUser }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'health' | 'subscription' | 'inbody' | 'photos'>('profile');

  const latestInBody = user.inbodyTracking[user.inbodyTracking.length - 1];

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-700 hover:text-[#ba181c] transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900">My Profile</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'profile' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Profile Info
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'health' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Health & Goals
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'subscription' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Subscription
            </button>
            <button
              onClick={() => setActiveTab('inbody')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'inbody' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              InBody Tracking
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'photos' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Progress Photos
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <UserIcon className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Personal Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={user.fullName}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={user.dateOfBirth}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={user.phone}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Gender</label>
                  <input
                    type="text"
                    value={user.gender}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Fitness Level</label>
                  <input
                    type="text"
                    value={user.fitnessLevel}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <Phone className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Emergency Contact</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={user.emergencyContact.name}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={user.emergencyContact.phone}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Relationship</label>
                  <input
                    type="text"
                    value={user.emergencyContact.relationship}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <Target className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Training Goals</h2>
              </div>
              <textarea
                value={user.trainingGoal}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                rows={3}
                readOnly
              />
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <Heart className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Health Information</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2">Health Conditions</label>
                  <textarea
                    value={user.healthInfo}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Injuries</label>
                  <textarea
                    value={user.injuryInfo}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Medical Notes</label>
                  <textarea
                    value={user.medicalNotes || 'None'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <Calendar className="w-6 h-6 text-[#ba181c]" />
              <h2 className="text-gray-900">Subscription Details</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-red-50 rounded-lg">
                <p className="text-gray-700 mb-2">Sessions Remaining</p>
                <p className="text-[#ba181c]">{user.subscription.sessionsBalance}</p>
              </div>
              <div className="p-6 bg-gray-100 rounded-lg">
                <p className="text-gray-700 mb-2">Subscription Expires</p>
                <p className="text-[#7b161b]">
                  {new Date(user.subscription.expiryDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbody' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <TrendingUp className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Latest InBody Scan</h2>
              </div>
              {latestInBody ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Scan Date: {new Date(latestInBody.date).toLocaleDateString()}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 mb-1">Weight</p>
                      <p className="text-gray-900">{latestInBody.weight} kg</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 mb-1">Body Fat</p>
                      <p className="text-gray-900">{latestInBody.bodyFatPercentage}%</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 mb-1">Muscle Mass</p>
                      <p className="text-gray-900">{latestInBody.muscleMass} kg</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-gray-900 mb-3">Measurements</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Chest</p>
                        <p className="text-gray-900">{latestInBody.measurements.chest} cm</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Waist</p>
                        <p className="text-gray-900">{latestInBody.measurements.waist} cm</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Hips</p>
                        <p className="text-gray-900">{latestInBody.measurements.hips} cm</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Arms</p>
                        <p className="text-gray-900">{latestInBody.measurements.arms} cm</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Thighs</p>
                        <p className="text-gray-900">{latestInBody.measurements.thighs} cm</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">No InBody scans recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Camera className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Progress Photos</h2>
              </div>
              <button className="bg-[#ba181c] text-white px-4 py-2 rounded-lg hover:bg-[#7b161b] transition-colors">
                Add Photo
              </button>
            </div>
            {user.progressPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {user.progressPhotos.map((photo, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <img src={photo.photoUrl} alt={`Progress ${index + 1}`} className="w-full h-48 object-cover" />
                    <div className="p-3">
                      <p className="text-gray-600 text-sm">{new Date(photo.date).toLocaleDateString()}</p>
                      {photo.notes && <p className="text-gray-900 text-sm mt-1">{photo.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No progress photos yet. Start tracking your transformation!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}