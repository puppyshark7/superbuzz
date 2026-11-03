import { useState } from 'react';
import SetupForm from './components/SetupForm';
import BuzzerInterface from './components/BuzzerInterface';
import { useStore, initialState } from './store';

export default function App() {
  const question = useStore(state => state.question);
  const resetState = useStore(state => state.resetState);
  
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const handleSetupComplete = () => {
    setIsSetupComplete(true);
  };

  const handleReset = () => {
    resetState();
    setIsSetupComplete(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-950">
      {!isSetupComplete && !question && (
        <SetupForm onComplete={handleSetupComplete} />
      )}
      
      {question && isSetupComplete && (
        <BuzzerInterface onReset={handleReset} />
      )}

      {/* Loading state */}
      {!question && !isSetupComplete && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <svg className="w-16 h-16 animate-spin" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
            <span className="text-xl font-semibold">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
