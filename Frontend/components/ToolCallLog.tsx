
import React from 'react';

interface ToolCallLogProps {
  toolCalls: string[];
}

const TerminalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
    </svg>
);


export const ToolCallLog: React.FC<ToolCallLogProps> = ({ toolCalls }) => {
  return (
    <div className="bg-black bg-opacity-30 rounded-lg p-4 h-64 flex flex-col font-mono">
      <h2 className="text-lg font-semibold text-purple-300 mb-2 border-b border-purple-300/20 pb-2">Tool Execution</h2>
      <div className="flex-grow overflow-y-auto text-sm text-gray-300">
        {toolCalls.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No tools executed yet.</p>
          </div>
        )}
        {toolCalls.map((call, index) => (
          <div key={index} className="mb-1">
            <span className="text-purple-400">&gt; </span>
            <span>{call}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
