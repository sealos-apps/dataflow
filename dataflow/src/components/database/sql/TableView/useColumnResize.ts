import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Manages column resize state and document-level mouse event listeners for drag resizing.
 * Returns current column widths and a handler to initiate resizing on mousedown.
 */
export function useColumnResize(columns: string[] | undefined): {
  columnWidths: Record<string, number>
  handleResizeStart: (e: React.MouseEvent, column: string) => void
} {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  // Initialize widths when columns first arrive
  useEffect(() => {
    if (columns && Object.keys(columnWidths).length === 0) {
      const initialWidths: Record<string, number> = {}
      columns.forEach((col) => {
        initialWidths[col] = Math.max(120, col.length * 10 + 60)
      })
      setColumnWidths(initialWidths)
    }
  }, [columns])

  // Document-level mousemove/mouseup for drag resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingRef.current) {
        const { column, startX, startWidth } = resizingRef.current
        const diff = e.clientX - startX
        const newWidth = Math.max(60, startWidth + diff)
        setColumnWidths(prev => ({ ...prev, [column]: newWidth }))
      }
    }

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null
        document.body.style.cursor = 'default'
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column] || 120,
    }
    document.body.style.cursor = 'col-resize'
  }, [columnWidths])

  return { columnWidths, handleResizeStart }
}
