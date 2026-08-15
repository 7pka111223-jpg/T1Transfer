import { useState } from 'react';
import { User, Booking } from '../App';
import { Calendar, Clock, UserCheck, ArrowLeft, Check } from 'lucide-react';

type BookingFlowProps = {
  user: User;
  onComplete: (booking: Booking) => void;
  onCancel: () => void;
};

const coaches = [
  { id: '1', name: 'Bebo Amir', specialty: 'Calisthenics & Strength Training', avatar: '👨🏻‍🦱' },
  { id: '2', name: 'Ahmed Sameh', specialty: 'Calisthenics & Strength Training', avatar: '🧔🏻' },
  { id: '3', name: 'Donia Mohamed', specialty: 'Fitness & Legs', avatar: '👩🏽‍🦱' },
  { id: '4', name: 'Farah Ali', specialty: 'Mobility & HIIT', avatar: '👩🏻' },
];

const timeSlots = [
  '06:00 PM', '07:00 PM', '08:00 PM'
];

export function BookingFlow({ user, onComplete, onCancel }: BookingFlowProps) {
  const [step, setStep] = useState<'date' | 'coach' | 'time' | 'confirm'
>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setStep('coach');
  };

  const handleCoachSelect = (coachId: string) => {
    setSelectedCoach(coachId);
    setStep('time');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const handleConfirm = () => {
    const coach = coaches.find(c => c.id === selectedCoach);
    const booking: Booking = {
      id: Date.now().toString(),
      userId: user.id,
      coachId: selectedCoach,
      coachName: coach?.name || '',
      date: selectedDate,
      time: selectedTime,
      status: 'confirmed'
    };
    onComplete(booking);
  };

  const getNextSevenDays = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        full: date.toISOString().split('T')[0],
        display: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return dates;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={step === 'date' ? onCancel : () => {
              if (step === 'coach') setStep('date');
              if (step === 'time') setStep('coach');
              if (step === 'confirm') setStep('time');
            }}
            className="text-gray-700 hover:text-[#ba181c] transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900">Book a Session</h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'date' ? 'bg-[#ba181c] text-white' : 'bg-green-600 text-white'
              }`}>
                {step === 'date' ? '1' : <Check className="w-5 h-5" />}
              </div>
              <span className="text-gray-900">Date</span>
            </div>
            
            <div className="flex-1 h-1 bg-gray-200 mx-4">
              <div className={`h-full bg-[#ba181c] transition-all ${
                step === 'coach' || step === 'time' || step === 'confirm' ? 'w-full' : 'w-0'
              }`} />
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'coach' ? 'bg-[#ba181c] text-white' : 
                step === 'time' || step === 'confirm' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step === 'time' || step === 'confirm' ? <Check className="w-5 h-5" /> : '2'}
              </div>
              <span className="text-gray-900">Coach</span>
            </div>

            <div className="flex-1 h-1 bg-gray-200 mx-4">
              <div className={`h-full bg-[#ba181c] transition-all ${
                step === 'time' || step === 'confirm' ? 'w-full' : 'w-0'
              }`} />
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'time' ? 'bg-[#ba181c] text-white' : 
                step === 'confirm' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step === 'confirm' ? <Check className="w-5 h-5" /> : '3'}
              </div>
              <span className="text-gray-900">Time</span>
            </div>

            <div className="flex-1 h-1 bg-gray-200 mx-4">
              <div className={`h-full bg-[#ba181c] transition-all ${
                step === 'confirm' ? 'w-full' : 'w-0'
              }`} />
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'confirm' ? 'bg-[#ba181c] text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                4
              </div>
              <span className="text-gray-900">Confirm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {step === 'date' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-6 h-6 text-[#ba181c]" />
              <h2 className="text-gray-900">Select a Date</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {getNextSevenDays().map((date) => (
                <button
                  key={date.full}
                  onClick={() => handleDateSelect(date.full)}
                  className="bg-white p-6 rounded-xl border-2 border-gray-200 hover:border-[#ba181c] transition-colors text-left"
                >
                  <p className="text-gray-900">{date.display}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'coach' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <UserCheck className="w-6 h-6 text-[#ba181c]" />
              <h2 className="text-gray-900">Choose Your Coach</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coaches.map((coach) => (
                <button
                  key={coach.id}
                  onClick={() => handleCoachSelect(coach.id)}
                  className="bg-white p-6 rounded-xl border-2 border-gray-200 hover:border-[#ba181c] transition-colors text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{coach.avatar}</div>
                    <div>
                      <h3 className="text-gray-900 mb-1">{coach.name}</h3>
                      <p className="text-gray-600">{coach.specialty}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'time' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-[#ba181c]" />
              <h2 className="text-gray-900">Select a Time</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {timeSlots.map((time) => (
                <button
                  key={time}
                  onClick={() => handleTimeSelect(time)}
                  className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-[#ba181c] transition-colors"
                >
                  <p className="text-gray-900">{time}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Check className="w-6 h-6 text-[#ba181c]" />
              <h2 className="text-gray-900">Confirm Your Booking</h2>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-6">
              <div className="space-y-4">
                <div>
                  <p className="text-gray-600 mb-1">Date</p>
                  <p className="text-gray-900">
                    {new Date(selectedDate).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Time</p>
                  <p className="text-gray-900">{selectedTime}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Coach</p>
                  <p className="text-gray-900">
                    {coaches.find(c => c.id === selectedCoach)?.name}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {coaches.find(c => c.id === selectedCoach)?.specialty}
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 mb-1">Sessions Remaining After Booking</p>
                  <p className="text-gray-900">{user.subscription.sessionsBalance - 1}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full bg-[#ba181c] text-white py-4 rounded-lg hover:bg-[#7b161b] transition-colors"
            >
              Confirm Booking
            </button>
          </div>
        )}
      </main>
    </div>
  );
}