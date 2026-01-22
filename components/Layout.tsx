import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <i className="fas fa-users-rays text-white text-lg"></i>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">Dad Circles</span>
        </div>
        <nav className="flex gap-4">
          <Link 
            to="/" 
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              location.pathname === '/' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Chat
          </Link>
          <Link 
            to="/admin" 
            className={`px-3 py-2 rounded-md text-sm font-medium transition ${
              location.pathname === '/admin' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Admin
          </Link>
        </nav>
      </header>
      <main className="flex-1 flex flex-col container mx-auto max-w-4xl px-4 py-6">
        {children}
      </main>
    </div>
  );
};