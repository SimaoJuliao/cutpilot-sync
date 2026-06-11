import { useState, useEffect } from 'react'
import type { ElectronFile, PipPosition } from '@/types'
import { basename } from '@lib'

export interface UseStepUploadReturn {
  // Main video
  file: string | null
  fileName: string | null
  dragging: boolean
  handlePick: () => Promise<void>
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: () => void
  handleDrop: (e: React.DragEvent) => void
  // Webcam video (optional)
  webcamFile: string | null
  webcamFileName: string | null
  webcamDragging: boolean
  syncOffsetSec: number
  handleWebcamPick: () => Promise<void>
  handleWebcamDragOver: (e: React.DragEvent) => void
  handleWebcamDragLeave: () => void
  handleWebcamDrop: (e: React.DragEvent) => void
  handleWebcamRemove: () => void
  setSyncOffsetSec: (v: number) => void
  // PiP overlay position (null = two separate files)
  pipPosition: PipPosition | null
  setPipPosition: (v: PipPosition | null) => void
  // FFmpeg
  ffmpegOk: boolean | null
}

const useStepUpload = (): UseStepUploadReturn => {
  const [file, setFile] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [webcamFile, setWebcamFile] = useState<string | null>(null)
  const [webcamDragging, setWebcamDragging] = useState(false)
  const [syncOffsetSec, setSyncOffsetSec] = useState(0)
  const [pipPosition, setPipPosition] = useState<PipPosition | null>(null)
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null)

  useEffect(() => { window.api.checkFFmpeg().then(setFfmpegOk) }, [])

  // ── Main video handlers ────────────────────────────────────────────────────
  const handlePick = async () => {
    const path = await window.api.selectVideo()
    if (path) setFile(path)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0] as ElectronFile | undefined
    if (f?.path) setFile(f.path)
  }

  // ── Webcam video handlers ──────────────────────────────────────────────────
  const handleWebcamPick = async () => {
    const path = await window.api.selectVideo()
    if (path) setWebcamFile(path)
  }

  const handleWebcamDragOver = (e: React.DragEvent) => { e.preventDefault(); setWebcamDragging(true) }
  const handleWebcamDragLeave = () => setWebcamDragging(false)
  const handleWebcamDrop = (e: React.DragEvent) => {
    e.preventDefault(); setWebcamDragging(false)
    const f = e.dataTransfer.files[0] as ElectronFile | undefined
    if (f?.path) setWebcamFile(f.path)
  }
  const handleWebcamRemove = () => { setWebcamFile(null); setSyncOffsetSec(0); setPipPosition(null) }

  return {
    file, fileName: file ? basename(file) : null,
    dragging, handlePick, handleDragOver, handleDragLeave, handleDrop,
    webcamFile, webcamFileName: webcamFile ? basename(webcamFile) : null,
    webcamDragging, syncOffsetSec,
    handleWebcamPick, handleWebcamDragOver, handleWebcamDragLeave, handleWebcamDrop,
    handleWebcamRemove, setSyncOffsetSec,
    pipPosition, setPipPosition,
    ffmpegOk,
  }
}

export default useStepUpload
