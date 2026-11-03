import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';

interface BuzzerInterfaceProps {
  onReset: () => void;
}

export default function BuzzerInterface({ onReset }: BuzzerInterfaceProps) {
  const question = useStore(state => state.question);
  const participants = useStore(state => state.participants);
  const teams = useStore(state => state.teams);
  const isLocked = useStore(state => state.isLocked);
  const buzzedParticipants = useStore(state => state.buzzedParticipants);
  
  const setBuzzerLocked = useStore(state => state.setBuzzerLocked);
  const addBuzzerParticipant = useStore(state => state.addBuzzerParticipant);

  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  // Check if any participant in a team has already buzzed (team lockout)
  useEffect(() => {
    let shouldLock = false;
    
    teams.forEach(team => {
      const participantsInTeam = participants.filter(p => p.teamId === team.id);
      const hasBuzzerParticipant = participantsInTeam.some(p => 
        isLocked && buzzedParticipants.has(p.id)
      );
      
      if (hasBuzzerParticipant) {
        shouldLock = true;
      }
    });

    if (shouldLock && !isLocked) {
      setBuzzerLocked(true);
    }
  }, [teams, participants, isLocked, buzzedParticipants]);

  const handleBuzz = useCallback(() => {
    if (!selectedParticipant || isLocked) return;
    
    addBuzzerParticipant(selectedParticipant);
    setSelectedParticipant('');
    
    // Lock the buzzer after first buzz (optional - can be configured)
    setBuzzerLocked(true);
  }, [selectedParticipant, isLocked, addBuzzerParticipant, setBuzzerLocked]);

  const handleReset = useCallback(() => {
    setShowResetModal(false);
    onReset();
  }, [onReset]);

  if (!question) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
      <div className="w-full max-w-4xl mx-auto p-6 md:p-10 lg:p-14 rounded-xl shadow-2xl bg-white text-gray-900">
        {/* Question Display */}
        <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-blue-700 text-center">
          <h1 className="text-3xl font-bold mb-4 tracking-tight">{question}</h1>
          {isLocked && (
            <div className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-red-500 text-white font-semibold">
              <svg xmlns="https://0 0 24 24" viewBox="0 0 24 24" className="w-6 h-6">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                <path d="M7 7 L17 17 M17 7 L7 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              LOCKED - Buzzer is now locked!
            </div>
          )}
        </div>

        {/* Participant Selection */}
        <div className="mb-8">
          <label htmlFor="participant-select" className="block text-lg font-semibold mb-2">Select a participant to buzz</label>
          <select
            id="participant-select"
            value={selectedParticipant}
            onChange={(e) => setSelectedParticipant(e.target.value)}
            disabled={isLocked}
            className="w-full p-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-lg"
          >
            <option value="">Choose a participant...</option>
            {participants.map(participant => (
              <option key={participant.id} value={participant.id}>
                {participant.name}{isLocked && buzzedParticipants.has(participant.id) ? ' (already buzzed)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Teams Display */}
        {teams.length > 0 && (
          <div className="mb-8 p-4 rounded-xl bg-gray-100">
            <h2 className="text-xl font-semibold mb-4">Team Status</h2>
            <div className="space-y-3">
              {teams.map(team => {
                const participantsInTeam = participants.filter(p => p.teamId === team.id);
                const hasBuzzerParticipant = participantsInTeam.some(p => 
                  isLocked && buzzedParticipants.has(p.id)
                );

                return (
                  <div key={team.id} className={`p-4 rounded-lg ${hasBuzzerParticipant ? 'bg-red-500' : 'bg-gray-200'}`}>
                    <h3 className="text-lg font-semibold mb-2">{team.name}</h3>
                    <ul className="space-y-1">
                      {participantsInTeam.map(participant => (
                        <li key={participant.id} className={`flex items-center gap-2 ${hasBuzzerParticipant && buzzedParticipants.has(participant.id) ? 'text-red-900' : ''}`}>
                          <span>{participant.name}</span>
                          {isLocked && buzzedParticipants.has(participant.id) && (
                            <svg xmlns="https://0 0 24 24" viewBox="0 0 24 24" className="w-6 h-6">
                              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                              <path d="M7 7 L17 17 M17 7 L7 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buzzer Button */}
        <button
          onClick={handleBuzz}
          disabled={!selectedParticipant || isLocked}
          className={`w-full py-5 rounded-xl text-white font-bold text-2xl tracking-wide transition-all duration-300 ${
            !isLocked && selectedParticipant 
              ? 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isLocked ? 'LOCKED' : selectedParticipant ? 'BZZR!' : 'Select a participant'}
        </button>

        {/* Reset Button */}
        <button
          onClick={() => setShowResetModal(true)}
          className="w-full mt-4 py-3 rounded-xl border-2 border-red-500 text-red-600 hover:bg-red-100 font-semibold"
        >
          Reset Buzzer
        </button>

        {/* Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="p-8 rounded-xl shadow-2xl bg-white text-gray-900 max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-4">Are you sure?</h2>
              <p className="mb-6">This will reset the question, participants, and all buzzes. This action cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-8 py-3 rounded-lg border-2 border-gray-300 hover:bg-gray-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
