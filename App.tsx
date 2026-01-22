import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatInterface } from './components/ChatInterface';
import LandingPage from './components/LandingPage';
import UserChatInterface from './components/UserChatInterface';
import { ProtectedAdminDashboard } from './components/ProtectedAdminDashboard';
import {
  AdminLayout,
  AdminOverview,
  AdminUsers,
  AdminUserDetail,
  AdminGroups,
  AdminGroupDetail,
  AdminLeads,
  AdminTools,
} from './components/admin';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page - no layout wrapper */}
        <Route path="/" element={<LandingPage />} />

        {/* User chat - no layout wrapper */}
        <Route path="/chat" element={<UserChatInterface />} />

        {/* Admin routes - with dark layout and protection */}
        <Route path="/admin" element={
          <ProtectedAdminDashboard>
            <AdminLayout />
          </ProtectedAdminDashboard>
        }>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetail />} />
          <Route path="groups" element={<AdminGroups />} />
          <Route path="groups/:groupId" element={<AdminGroupDetail />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="tools" element={<AdminTools />} />
        </Route>

        {/* Legacy admin chat route */}
        <Route path="/admin-chat" element={
          <ProtectedAdminDashboard>
            <Layout>
              <ChatInterface />
            </Layout>
          </ProtectedAdminDashboard>
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
