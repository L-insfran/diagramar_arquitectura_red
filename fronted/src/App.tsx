import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CompanyProvider, useCompany } from './contexts/CompanyContext'
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
import Employees from './pages/Employees'
import EmployeeDetail from './pages/EmployeeDetail'
import Settings from './pages/Settings'
import Users from './pages/Users'
import DeviceTypes from './pages/DeviceTypes'
import Clients from './pages/Clients'
import SelectClient from './pages/SelectClient'

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

function CompanyGate({ children }: { children: React.ReactNode }) {
  const { needsCompanySelection, isLoading } = useCompany()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (needsCompanySelection) return <Navigate to="/select-client" replace />
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
        path="/select-client"
        element={
          <ProtectedRoute>
            <SelectClient />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <CompanyGate>
              <MainLayout />
            </CompanyGate>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
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
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/clients" element={<GlobalAdminOnly><Clients /></GlobalAdminOnly>} />
        <Route path="/settings" element={<MutateOnly><Settings /></MutateOnly>} />
        <Route path="/settings/users" element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="/settings/device-types" element={<AdminOnly><DeviceTypes /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CompanyProvider>
            <ToastProvider>
              <AppRoutes />
              <ToastViewport />
            </ToastProvider>
          </CompanyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
