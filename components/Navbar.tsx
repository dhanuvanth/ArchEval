import React from 'react';
import { ViewState } from '../types';
import { User, Activity, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  currentView: ViewState;
  changeView: (view: ViewState) => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, changeView, isAdmin }) => {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center cursor-pointer" onClick={() => changeView(ViewState.ASSESSMENT)}>
            <Activity className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-bold text-slate-800 tracking-tight">ArchEval</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => changeView(ViewState.ASSESSMENT)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === ViewState.ASSESSMENT || currentView === ViewState.RESULT ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Assessment
            </button>
            <button 
              onClick={() => changeView(ViewState.RULES)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === ViewState.RULES ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Rules & Logic
            </button>
            
            {isAdmin && (
               <button 
               onClick={() => changeView(ViewState.ADMIN)}
               className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === ViewState.ADMIN ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <LayoutDashboard className="w-4 h-4 mr-1"/>
               Dashboard
             </button>
            )}

            <button 
              onClick={() => changeView(isAdmin ? ViewState.ADMIN : ViewState.LOGIN)}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              title="Admin Login"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};