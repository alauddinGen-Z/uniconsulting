/**
 * AdmitAI Agent Popup
 * 
 * Main extension popup interface with:
 * - Authentication status indicator
 * - Student selector (for consultants)
 * - Auto-fill button
 * 
 * @file extension/src/popup.tsx
 */

import { useEffect, useState } from 'react'
import { Sparkles, LogOut, User, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Student } from './lib/types'
import { fetchStudentProfile, fetchTeacherStudents, mapFormFields } from './lib/api'
import './style.css'

// API base URL for the main web app
const WEBAPP_URL = process.env.PLASMO_PUBLIC_WEBAPP_URL || 'http://localhost:3000'

interface AuthStatus {
  authenticated: boolean
  user: { id: string; email: string } | null
  hasSession: boolean
}

type FillStatus = 'idle' | 'scanning' | 'mapping' | 'filling' | 'success' | 'error'

function Popup() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [fillStatus, setFillStatus] = useState<FillStatus>('idle')
  const [fillMessage, setFillMessage] = useState('')

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()

    // Listen for auth state changes
    const listener = (message: any) => {
      if (message.type === 'AUTH_STATE_CHANGED') {
        checkAuthStatus()
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' })
      setAuthStatus(response)

      if (response.authenticated) {
        await loadStudentData()
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setAuthStatus({ authenticated: false, user: null, hasSession: false })
    } finally {
      setIsLoading(false)
    }
  }

  const loadStudentData = async () => {
    try {
      // Try to fetch teacher's students first
      const teacherStudents = await fetchTeacherStudents()

      if (teacherStudents.length > 0) {
        setIsTeacher(true)
        setStudents(teacherStudents)
        setSelectedStudent(teacherStudents[0])
      } else {
        // User is a student, fetch their own profile
        setIsTeacher(false)
        const profile = await fetchStudentProfile()
        if (profile) {
          setSelectedStudent(profile)
        }
      }
    } catch (error) {
      console.error('Failed to load student data:', error)
    }
  }

  const handleLogin = () => {
    // Open the main webapp login page with extension ID for token handoff
    const extensionId = chrome.runtime.id
    const loginUrl = `${WEBAPP_URL}/login?ext=${extensionId}`
    chrome.tabs.create({ url: loginUrl })
  }

  const handleLogout = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'SIGN_OUT' })
      setAuthStatus({ authenticated: false, user: null, hasSession: false })
      setSelectedStudent(null)
      setStudents([])
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  const handleAutoFill = async () => {
    if (!selectedStudent) return

    try {
      // Step 1: Scan the page
      setFillStatus('scanning')
      setFillMessage('Scanning form fields...')

      const scanResult = await chrome.runtime.sendMessage({ type: 'SCAN_PAGE' })

      if (!scanResult.success || !scanResult.elements?.length) {
        setFillStatus('error')
        setFillMessage('No form fields found on this page')
        return
      }

      // Step 2: Map fields with AI
      setFillStatus('mapping')
      setFillMessage(`Found ${scanResult.elements.length} fields. Mapping with AI...`)

      const mapping = await mapFormFields(scanResult.elements, selectedStudent)

      if (!mapping?.length) {
        setFillStatus('error')
        setFillMessage('Could not map any fields to student data')
        return
      }

      // Step 3: Fill the page
      setFillStatus('filling')
      setFillMessage('Filling form fields...')

      const fillResult = await chrome.runtime.sendMessage({
        type: 'FILL_PAGE',
        mapping
      })

      if (fillResult.success) {
        setFillStatus('success')
        setFillMessage(`Successfully filled ${fillResult.filled} fields!`)
      } else {
        setFillStatus('error')
        setFillMessage('Failed to fill form fields')
      }

      // Reset status after delay
      setTimeout(() => {
        setFillStatus('idle')
        setFillMessage('')
      }, 3000)

    } catch (error: any) {
      setFillStatus('error')
      setFillMessage(error.message || 'An error occurred')

      setTimeout(() => {
        setFillStatus('idle')
        setFillMessage('')
      }, 3000)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="w-10 h-10 text-brand-primary-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading AdmitAI Agent...</p>
      </div>
    )
  }

  // Not authenticated
  if (!authStatus?.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 flex items-center justify-center mb-6 shadow-lg shadow-brand-primary-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold mb-2">AdmitAI Agent</h1>
        <p className="text-slate-400 text-sm mb-8 max-w-[280px]">
          Sign in to autofill university applications with your profile data
        </p>

        <button
          onClick={handleLogin}
          className="btn-primary flex items-center gap-2 w-full justify-center"
        >
          <ExternalLink className="w-4 h-4" />
          Login via Web Dashboard
        </button>

        <p className="text-slate-500 text-xs mt-4">
          Your session will sync automatically
        </p>
      </div>
    )
  }

  // Authenticated view
  return (
    <div className="flex flex-col min-h-[400px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 flex items-center justify-center shadow-lg shadow-brand-primary-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold">AdmitAI Agent</h1>
            <div className="flex items-center gap-1.5">
              <div className="status-dot connected" />
              <span className="text-xs text-green-400">Connected</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-surface-overlay transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* User Info */}
      <div className="card mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-overlay flex items-center justify-center">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {authStatus.user?.email}
            </p>
            <p className="text-xs text-slate-400">
              {isTeacher ? 'Consultant' : 'Student'}
            </p>
          </div>
        </div>
      </div>

      {/* Student Selector (for teachers) */}
      {isTeacher && students.length > 0 && (
        <div className="card mb-4">
          <label className="text-xs font-medium text-slate-400 uppercase mb-2 block">
            Select Student
          </label>
          <select
            className="select-field"
            value={selectedStudent?.id || ''}
            onChange={(e) => {
              const student = students.find(s => s.id === e.target.value)
              setSelectedStudent(student || null)
            }}
          >
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.full_name || student.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current Student Info */}
      {selectedStudent && (
        <div className="card mb-4 flex-1">
          <label className="text-xs font-medium text-slate-400 uppercase mb-2 block">
            Current Student
          </label>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Name</span>
              <span className="font-medium">{selectedStudent.full_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">GPA</span>
              <span className="font-medium">{selectedStudent.gpa || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">SAT</span>
              <span className="font-medium">{selectedStudent.sat_score || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {fillMessage && (
        <div className={`card mb-4 flex items-center gap-2 ${fillStatus === 'error' ? 'border-red-500/50 bg-red-500/10' :
            fillStatus === 'success' ? 'border-green-500/50 bg-green-500/10' :
              ''
          }`}>
          {fillStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
          {fillStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
          {['scanning', 'mapping', 'filling'].includes(fillStatus) && (
            <Loader2 className="w-4 h-4 text-brand-primary-500 animate-spin flex-shrink-0" />
          )}
          <span className="text-sm">{fillMessage}</span>
        </div>
      )}

      {/* Auto-Fill Button */}
      <button
        onClick={handleAutoFill}
        disabled={!selectedStudent || ['scanning', 'mapping', 'filling'].includes(fillStatus)}
        className="btn-primary flex items-center justify-center gap-2 mt-auto"
      >
        {['scanning', 'mapping', 'filling'].includes(fillStatus) ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        ✨ Auto-Fill this Application
      </button>

      {/* Footer */}
      <p className="text-xs text-slate-500 text-center mt-3">
        Works best on Common App, Coalition, and UC Applications
      </p>
    </div>
  )
}

export default Popup
