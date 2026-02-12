import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, headerContent, onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button 
                onClick={onBack}
                className="mr-2 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors group"
                aria-label="Go back"
                title="Leave Session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:text-slate-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </button>
            )}
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              T
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">TheraSync<span className="text-teal-600">Live</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {headerContent}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};