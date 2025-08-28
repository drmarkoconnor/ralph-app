import { useState } from 'react'

export default function SidebarLayout({
  left,
  right,
  children,
  defaultLeftOpen = true,
  defaultRightOpen = true,
}) {
  const [leftOpen, setLeftOpen] = useState(defaultLeftOpen)
  const [rightOpen, setRightOpen] = useState(defaultRightOpen)
  return (
      <div className="min-h-screen w-full relative">
      <div className="flex items-stretch">
        {/* Left sidebar */}
          <div className={`${leftOpen ? 'w-72' : 'w-10'} transition-all duration-200 border-r bg-white relative`}
             aria-label="Left sidebar">
          <div className="h-10 flex items-center justify-between px-2 border-b">
            <span className="text-xs font-semibold text-gray-700">Options</span>
            <button
              className="text-xs px-2 py-0.5 rounded border bg-white"
              onClick={() => setLeftOpen(!leftOpen)}
              title={leftOpen ? 'Hide options' : 'Show options'}
            >{leftOpen ? '⟨' : '⟩'}</button>
          </div>
          <div className={`${leftOpen ? 'p-2' : 'p-0'} overflow-y-auto max-h-[calc(100vh-40px)]`}>
            {leftOpen ? left : null}
          </div>
            {!leftOpen && (
              <button
                className="absolute top-12 -right-3 z-20 w-6 h-8 rounded-md shadow bg-white border text-xs"
                onClick={() => setLeftOpen(true)}
                title="Expand left panel"
              >
                ▶
              </button>
            )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-screen bg-gradient-to-b from-white to-slate-50">
          {children}
        </div>

        {/* Right sidebar */}
          <div className={`${rightOpen ? 'w-72' : 'w-10'} transition-all duration-200 border-l bg-white relative`}
             aria-label="Right sidebar">
          <div className="h-10 flex items-center justify-between px-2 border-b">
            <span className="text-xs font-semibold text-gray-700">Panel</span>
            <button
              className="text-xs px-2 py-0.5 rounded border bg-white"
              onClick={() => setRightOpen(!rightOpen)}
              title={rightOpen ? 'Hide panel' : 'Show panel'}
            >{rightOpen ? '⟩' : '⟨'}</button>
          </div>
          <div className={`${rightOpen ? 'p-2' : 'p-0'} overflow-y-auto max-h-[calc(100vh-40px)]`}>
            {rightOpen ? right : null}
          </div>
            {!rightOpen && (
              <button
                className="absolute top-12 -left-3 z-20 w-6 h-8 rounded-md shadow bg-white border text-xs"
                onClick={() => setRightOpen(true)}
                title="Expand right panel"
              >
                ◀
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
