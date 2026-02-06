
import React from 'react';

interface ControlsProps {
    isSessionActive: boolean;
    isLoading: boolean;
    onToggle: () => void;
}

export const Controls: React.FC<ControlsProps> = ({ isSessionActive, isLoading, onToggle }) => {
    const buttonText = isLoading ? 'Connecting...' : (isSessionActive ? 'Deactivate JARVIS' : 'Activate JARVIS');
    const buttonClass = `px-8 py-4 text-lg font-semibold rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-4
    ${isLoading ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
    isSessionActive ? 
        'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 focus:ring-red-500/50' :
        'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/30 focus:ring-cyan-500/50'
    }`;


    return (
        <div className="flex items-center justify-center">
            <button
                onClick={onToggle}
                disabled={isLoading}
                className={buttonClass}
            >
                {buttonText}
            </button>
        </div>
    );
};
