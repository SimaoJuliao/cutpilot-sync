import { useState, useEffect } from 'react'
import type { ElectronFile } from '@/types'
import { basename } from '@lib'

export interface UseStepUploadReturn {
  file:            string | null
  fileName:        string | null
  dragging:        boolean
  ffmpegOk:        boolean | null
  handlePick:      () => Promise<void>
  handleDragOver:  (e: React.DragEvent) => void
  handleDragLeave: () => void
  handleDrop:      (e: React.DragEvent) => void
}

const useStepUpload = (): UseStepUploadReturn => {
  const [file,     setFile]     = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null)

  useEffect(() => { window.api.checkFFmpeg().then(setFfmpegOk) }, [])

  const handlePick = async () => {
    const path = await window.api.selectVideo()
    if (path) setFile(path)
  }

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0] as ElectronFile | undefined
    if (f?.path) setFile(f.path)
  }

  return {
    file, fileName: file ? basename(file) : null,
    dragging, ffmpegOk,
    handlePick, handleDragOver, handleDragLeave, handleDrop,
  }
}

export default useStepUpload
