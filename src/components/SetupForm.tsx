import { useState, useCallback } from 'react';
import { useStore } from '../store';

interface SetupFormProps {
  onComplete: () => void;
}

export default function SetupForm({ onComplete }: SetupFormProps) {
  const [question, setQuestion] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [selectedParticipantForTeam, setSelectedParticipantForTeam] = useState('');
  const [selectedTeamForAssignment, setSelectedTeamForAssignment] = useState('');
  
  const addParticipant = useStore(state => state.addParticipant);
  const removeParticipant = useStore(state => state.removeParticipant);
  const addTeam = useStore(state => state.addTeam);
  const removeTeam = useStore(state => state.removeTeam);
  const setQuestionState = useStore(state => state.setQuestion);
  const addParticipantToTeam = useStore(state => state.addParticipantToTeam);
  
  const participants = useStore(state => state.participants);
  const teams = useStore(state => state.teams);

  const handleAddParticipant = useCallback(() => {
    if (participantName.trim()) {
      addParticipant({
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: participantName.trim(),
      });
      setParticipantName('');
    }
  }, [participantName, addParticipant]);

  const handleAddTeam = useCallback(() => {
    if (teamName.trim()) {
      addTeam({
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: teamName.trim(),
      });
      setTeamName('');
    }
  }, [teamName, addTeam]);

  const handleAssignParticipantToTeam = useCallback(() => {
    if (selectedParticipantForTeam && selectedTeamForAssignment) {
      addParticipantToTeam(selectedParticipantForTeam, selectedTeamForAssignment);
      setSelectedParticipantForTeam('');
      setSelectedTeamForAssignment('');
    }
  }, [selectedParticipantForTeam, selectedTeamForAssignment, addParticipantToTeam]);

  const handleComplete = useCallback(() => {
    if (question.trim()) {
      setQuestionState(question.trim());
      onComplete();
    }
  }, [question, setQuestionState, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
      <div className="w-full max-w-2xl mx-auto p-6 md:p-10 lg:p-14 rounded-xl shadow-2xl bg-white text-gray-900">
        <h1 className="text-center text-3xl font-bold mb-8 tracking-tight">Set Up Your Buzzer</h1>
        
        {/* Question Input */}
        <div className="mb-8">
          <label htmlFor="question" className="block text-lg font-semibold mb-2">Competition Question</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter the competition question here..."
            className="w-full p-4 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none"
            rows={6}
          />
        </div>

        {/* Participants Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Participants</h2>
          
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="Enter participant name..."
              className="flex-1 p-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            <button
              onClick={handleAddParticipant}
              disabled={!participantName.trim()}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold"
            >
              Add
            </button>
          </div>

          <ul className="space-y-2">
            {participants.map(participant => (
              <li key={participant.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-100">
                <span>{participant.name}</span>
                <button
                  onClick={() => removeParticipant(participant.id)}
                  className="px-4 py-2 text-red-600 hover:text-red-800 font-semibold"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Teams Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Teams (Optional)</h2>
          
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name..."
              className="flex-1 p-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            <button
              onClick={handleAddTeam}
              disabled={!teamName.trim()}
              className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold"
            >
              Add Team
            </button>
          </div>

          <ul className="space-y-2">
            {teams.map(team => (
              <li key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-100">
                <span>{team.name}</span>
                <button
                  onClick={() => removeTeam(team.id)}
                  className="px-4 py-2 text-red-600 hover:text-red-800 font-semibold"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {teams.length > 0 && participants.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold mb-2">Assign Participants to Teams</h3>
              <div className="flex gap-3 items-end">
                <select
                  value={selectedParticipantForTeam}
                  onChange={(e) => setSelectedParticipantForTeam(e.target.value)}
                  className="p-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select a participant...</option>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
                <span className="text-xl">→</span>
                <select
                  value={selectedTeamForAssignment}
                  onChange={(e) => setSelectedTeamForAssignment(e.target.value)}
                  className="p-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssignParticipantToTeam}
                  disabled={!selectedParticipantForTeam || !selectedTeamForAssignment}
                  className="px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold"
                >
                  Assign
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Complete Button */}
        <button
          onClick={handleComplete}
          disabled={!question.trim()}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold text-lg tracking-wide"
        >
          Start Buzzer
        </button>
      </div>
    </div>
  );
}
