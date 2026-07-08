import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import FacultyDashboard from './pages/faculty/FacultyDashboard'
import CreateAssignment from './pages/faculty/CreateAssignment'
import AssignmentDetail from './pages/faculty/AssignmentDetail'
import SubmissionReview from './pages/faculty/SubmissionReview'
import StudentDashboard from './pages/student/StudentDashboard'
import TakeAssignment from './pages/student/TakeAssignment'
import StudentResult from './pages/student/StudentResult'

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    return <Navigate to="/login" replace />
  }

  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'faculty') {
    return <Navigate to="/faculty/dashboard" replace />
  }

  return <Navigate to="/student/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '14px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              background: '#020617',
              color: '#e2e8f0',
              border: '1px solid rgba(51, 65, 85, 0.9)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            },
            success: {
              iconTheme: {
                primary: '#34d399',
                secondary: '#020617',
              },
            },
            error: {
              iconTheme: {
                primary: '#f87171',
                secondary: '#020617',
              },
            },
          }}
        />

        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Faculty routes */}
          <Route
            path="/faculty/dashboard"
            element={
              <ProtectedRoute role="faculty">
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty/assignments/create"
            element={
              <ProtectedRoute role="faculty">
                <CreateAssignment />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty/assignments/:id"
            element={
              <ProtectedRoute role="faculty">
                <AssignmentDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty/submissions/:id/review"
            element={
              <ProtectedRoute role="faculty">
                <SubmissionReview />
              </ProtectedRoute>
            }
          />

          {/* Student routes */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/assignments/:id"
            element={
              <ProtectedRoute role="student">
                <TakeAssignment />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/results/:submissionId"
            element={
              <ProtectedRoute role="student">
                <StudentResult />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}