'use client'

import { usePensieve } from '../../context/PensieveContext'
import { UploadImageModalProps } from './types'
import NewProjectModal from './NewProjectModal'
import EditProjectModal from './EditProjectModal'

export default function UploadImageModal({ isOpen, onClose, onUploadComplete, user }: UploadImageModalProps) {
  const { editingProject, editingProjectId, clearEditingProject } = usePensieve()
  
  if (!isOpen) return null

  // editingProject가 있으면 편집 모드, 없으면 새 프로젝트 모드
  if (editingProject) {
    return (
      <EditProjectModal
        isOpen={isOpen}
        onClose={onClose}
        onUploadComplete={onUploadComplete}
        user={user}
        editingProject={editingProject}
        editingProjectId={editingProjectId}
        clearEditingProject={clearEditingProject}
      />
    )
  } else {
    return (
      <NewProjectModal
        isOpen={isOpen}
        onClose={onClose}
        onUploadComplete={onUploadComplete}
        user={user}
      />
    )
  }
}
