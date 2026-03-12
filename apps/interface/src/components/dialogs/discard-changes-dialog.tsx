import { createPortal } from 'react-dom'

interface DiscardChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: DiscardChangesDialogProps) {
  const handleCancel = () => {
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  if (!open) return null

  const dialog = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-dialog-title-shared"
    >
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={handleCancel}
        aria-hidden="true"
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
        <h3 id="discard-dialog-title-shared" className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Are you sure you want to discard your changes?
        </h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            No, continue editing
          </button>
          <button
            type="button"
            autoFocus
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
          >
            Yes, discard
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : null
}
