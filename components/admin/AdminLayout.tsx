import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { path: '/admin', label: 'Overview', icon: 'fa-chart-line' },
    { path: '/admin/users', label: 'Users', icon: 'fa-users' },
    { path: '/admin/groups', label: 'Groups', icon: 'fa-user-group' },
    { path: '/admin/leads', label: 'Leads', icon: 'fa-envelope' },
    { path: '/admin/tools', label: 'Dev Tools', icon: 'fa-wrench' },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg flex-shrink-0">
            <i className="fas fa-users-rays text-white text-lg"></i>
          </div>
          {!sidebarCollapsed && (
            <div>
              <span className="text-lg font-bold text-white">Dad Circles</span>
              <span className="block text-xs text-slate-500">Admin Panel</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon} w-5 text-center`}></i>
              {!sidebarCollapsed && (
                <>
                  <span className="font-medium">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>

        {/* Back to App */}
        <div className="p-3 border-t border-slate-800">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <i className="fas fa-arrow-left w-5 text-center"></i>
            {!sidebarCollapsed && <span className="text-sm">Back to App</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {navItems.find(item => isActive(item.path))?.label || 'Admin'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
