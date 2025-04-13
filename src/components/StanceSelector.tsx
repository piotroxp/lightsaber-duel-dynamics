import React from 'react';

interface StanceSelectorProps {
  stances: {id: number, name: string, description: string}[];
  currentStance: number;
  onSelectStance: (stanceId: number) => void;
}

const StanceSelector: React.FC<StanceSelectorProps> = ({ 
  stances, 
  currentStance, 
  onSelectStance 
}) => {
  const handleStanceClick = (id: number) => {
    console.log(`Stance button clicked: ${id}`);
    onSelectStance(id);
  };

  return (
    <div className="absolute bottom-4 right-4 bg-black/60 p-3 rounded-lg text-white">
      <h3 className="text-center font-bold mb-2">Lightsaber Stances</h3>
      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        {stances.map(stance => (
          <button
            key={stance.id}
            className={`px-3 py-2 text-left rounded ${
              stance.id === currentStance 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => handleStanceClick(stance.id)}
          >
            <div className="font-medium">{stance.name}</div>
            <div className="text-xs opacity-80">{stance.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StanceSelector; 