import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProjectProvider, useProject } from './contexts/ProjectContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastViewport } from './components/ToastViewport'
import { MainLayout } from './layouts/MainLayout'
import { usePermissions } from './hooks/usePermissions'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import DeviceCreate from './pages/DeviceCreate'
import Vlans from './pages/Vlans'
import VlanCreate from './pages/VlanCreate'
import Networks from './pages/Networks'
import NetworkCreate from './pages/NetworkCreate'
import Topology from './pages/Topology'
import Settings from './pages/Settings'
import Users from './pages/Users'
import DeviceTypes from './pages/DeviceTypes'
import DeviceTemplates from './pages/DeviceTemplates'
import Sites from './pages/Sites'
import Racks from './pages/Racks'
import PortTypes from './pages/PortTypes'
import CableTypes from './pages/CableTypes'
import Projects from './pages/Projects'
import SelectProject from './pages/SelectProject'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function MutateOnly({ children }: { children: React.ReactNode }) {
  const { canMutate } = usePermissions()
  if (!canMutate) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isGlobalAdmin, isAdmin } = usePermissions()
  if (!isGlobalAdmin && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function GlobalAdminOnly({ children }: { children: React.ReactNode }) {
  const { isGlobalAdmin } = usePermissions()
  if (!isGlobalAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function ProjectGate({ children }: { children: React.ReactNode }) {
  const { needsProjectSelection, isLoading } = useProject()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (needsProjectSelection) return <Navigate to="/select-project" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/select-project"
        element={
          <ProtectedRoute>
            <SelectProject />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <ProjectGate>
              <MainLayout />
            </ProjectGate>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/racks" element={<Racks />} />
        <Route path="/devices/new" element={<DeviceCreate />} />
        <Route path="/devices/:id/edit" element={<DeviceCreate />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/vlans" element={<Vlans />} />
        <Route path="/vlans/new" element={<MutateOnly><VlanCreate /></MutateOnly>} />
        <Route path="/vlans/:id/edit" element={<MutateOnly><VlanCreate /></MutateOnly>} />
        <Route path="/networks" element={<Networks />} />
        <Route path="/networks/new" element={<MutateOnly><NetworkCreate /></MutateOnly>} />
        <Route path="/networks/:id/edit" element={<MutateOnly><NetworkCreate /></MutateOnly>} />
        <Route path="/topology" element={<Topology />} />
        <Route path="/employees" element={<Navigate to="/" replace />} />
        <Route path="/employees/:id" element={<Navigate to="/" replace />} />
        <Route path="/projects" element={<GlobalAdminOnly><Projects /></GlobalAdminOnly>} />
        <Route path="/settings" element={<MutateOnly><Settings /></MutateOnly>} />
        <Route path="/settings/users" element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="/settings/device-types" element={<AdminOnly><DeviceTypes /></AdminOnly>} />
        <Route path="/settings/device-templates" element={<MutateOnly><DeviceTemplates /></MutateOnly>} />
        <Route path="/settings/sites" element={<MutateOnly><Sites /></MutateOnly>} />
        <Route path="/settings/racks" element={<Navigate to="/racks" replace />} />
        <Route path="/settings/port-types" element={<AdminOnly><PortTypes /></AdminOnly>} />
        <Route path="/settings/cable-types" element={<AdminOnly><CableTypes /></AdminOnly>} />
      </Route>
      <Route path="/select-client" element={<Navigate to="/select-project" replace />} />
      <Route path="/clients" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <ToastProvider>
              <AppRoutes />
              <ToastViewport />
            </ToastProvider>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
