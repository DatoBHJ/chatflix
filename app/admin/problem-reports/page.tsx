'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function ProblemReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log("Current user:", user)
        
        // TEMPORARY: Allow all users to access the admin page for development
        setIsAuthorized(true)
        
        // Load reports via API
        const response = await fetch('/api/admin/problem-reports')
        console.log('Problem reports API response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('Successfully fetched reports:', data?.length || 0, 'reports')
          setReports(data || [])
        } else {
          const errorData = await response.json()
          console.error('Error fetching problem reports:', errorData)
        }
      } catch (error) {
        console.error('Authentication error:', error)
        // Don't redirect for development
        setIsAuthorized(true)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Unauthorized access</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Problem Reports</h1>
      <div className="bg-background rounded-lg border border-[var(--accent)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--accent)]">
            <thead className="bg-[var(--accent)]/30">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6">User</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Type</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Content</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Status</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Submitted</th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--accent)]">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-6">
                    <div className="font-semibold">{report.email || report.user_id}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      report.report_type === 'bug_report' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                      report.report_type === 'safety_issue' ? 'bg-yellow-50 text-yellow-800 ring-yellow-600/20' :
                      'bg-blue-50 text-blue-700 ring-blue-600/20'
                    }`}>
                      {report.report_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm max-w-md">
                    <p className="truncate hover:whitespace-normal">{report.content}</p>
                    {report.chat_id && (
                      <Link href={`/admin/chat-viewer/${report.chat_id}`} className="text-blue-500 hover:underline text-xs">
                        View Chat
                      </Link>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        report.status === 'new' ? 'bg-gray-50 text-gray-600 ring-gray-500/10' :
                        report.status === 'in_progress' ? 'bg-orange-50 text-orange-700 ring-orange-600/20' :
                        'bg-green-50 text-green-700 ring-green-600/20'
                    }`}>
                        {report.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)]">
                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    {/* Actions can be added here, e.g., update status */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reports.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium">No reports found</h3>
              <p className="text-[var(--muted)] mt-1">When users submit feedback, it will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 