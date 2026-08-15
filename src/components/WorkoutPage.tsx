import { useState } from 'react';
import { User } from '../App';
import { ArrowLeft, Plus, TrendingUp, Dumbbell } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type WorkoutPageProps = {
  user: User;
  onBack: () => void;
};

type WorkoutLog = {
  id: string;
  date: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
};

type PersonalRecord = {
  exercise: string;
  weight: number;
  date: string;
};

const mockWorkoutLogs: WorkoutLog[] = [
  { id: '1', date: '2025-12-07', exercise: 'Bench Press', sets: 3, reps: 10, weight: 80 },
  { id: '2', date: '2025-12-07', exercise: 'Squat', sets: 4, reps: 8, weight: 100 },
  { id: '3', date: '2025-12-05', exercise: 'Deadlift', sets: 3, reps: 6, weight: 120 },
  { id: '4', date: '2025-12-05', exercise: 'Pull-ups', sets: 3, reps: 12, weight: 0 },
];

const mockPersonalRecords: PersonalRecord[] = [
  { exercise: 'Pull-ups', weight: 85, date: '2025-11-15' },
  { exercise: 'Dips', weight: 110, date: '2025-11-20' },
  { exercise: 'Push-ups', weight: 130, date: '2025-12-01' },
];

const mockProgressData = [
  { date: 'Nov 1', weight: 76 },
  { date: 'Nov 8', weight: 75.5 },
  { date: 'Nov 15', weight: 75.2 },
  { date: 'Nov 22', weight: 75 },
  { date: 'Nov 29', weight: 75.3 },
  { date: 'Dec 6', weight: 75 },
];

export function WorkoutPage({ user, onBack }: WorkoutPageProps) {
  const [activeTab, setActiveTab] = useState<'workouts' | 'progress'>('workouts');
  const [showAddWorkout, setShowAddWorkout] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-700 hover:text-[#ba181c] transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900">Workout & Progress</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('workouts')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'workouts' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Workout Logs
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'progress' 
                  ? 'border-[#ba181c] text-[#ba181c]' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Progress Charts
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'workouts' && (
          <div className="space-y-6">
            {/* Personal Records */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <TrendingUp className="w-6 h-6 text-[#ba181c]" />
                <h2 className="text-gray-900">Personal Records</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mockPersonalRecords.map((record, index) => (
                  <div key={index} className="p-4 bg-gradient-to-br from-red-50 to-gray-50 rounded-lg">
                    <p className="text-gray-900 mb-1">{record.exercise}</p>
                    <p className="text-[#ba181c]">{record.weight} kg</p>
                    <p className="text-gray-600 text-sm">{new Date(record.date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Workout Logs */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Dumbbell className="w-6 h-6 text-[#ba181c]" />
                  <h2 className="text-gray-900">Recent Workouts</h2>
                </div>
                <button
                  onClick={() => setShowAddWorkout(true)}
                  className="flex items-center gap-2 bg-[#ba181c] text-white px-4 py-2 rounded-lg hover:bg-[#7b161b] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Log Workout
                </button>
              </div>

              <div className="space-y-4">
                {mockWorkoutLogs.map((log) => (
                  <div key={log.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-gray-900">{log.exercise}</h3>
                      <span className="text-gray-600 text-sm">
                        {new Date(log.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-4 text-gray-600">
                      <span>{log.sets} sets</span>
                      <span>·</span>
                      <span>{log.reps} reps</span>
                      <span>·</span>
                      <span>{log.weight > 0 ? `${log.weight} kg` : 'Bodyweight'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Workout Modal */}
            {showAddWorkout && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full">
                  <h2 className="text-gray-900 mb-4">Log Workout</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-700 mb-2">Exercise</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="e.g., Bench Press"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-gray-700 mb-2">Sets</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          placeholder="3"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">Reps</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-2">Weight (kg)</label>
                        <input
                          type="number"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          placeholder="80"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setShowAddWorkout(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowAddWorkout(false)}
                        className="flex-1 px-4 py-2 bg-[#ba181c] text-white rounded-lg hover:bg-[#7b161b] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress tab removed: now handled by main dashboard */}
      </main>
    </div>
  );
}
