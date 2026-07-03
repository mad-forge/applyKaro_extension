import { useEffect, useRef, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'

export default function JdCard({ jd, onJdChange, jdStatus, loadingJd, onExtract }) {
  const textareaRef = useRef(null)
  const [scrollState, setScrollState] = useState({ up: false, down: false })

  const updateScrollState = () => {
    const node = textareaRef.current
    if (!node) return
    const canScroll = node.scrollHeight > node.clientHeight + 1
    setScrollState({
      up: canScroll && node.scrollTop > 2,
      down: canScroll && node.scrollTop + node.clientHeight < node.scrollHeight - 2,
    })
  }

  useEffect(() => {
    updateScrollState()
  }, [jd])

  return (
    <section className="card">
      <div className="section-heading">
        <div className="section-heading-left">
          <div className="section-icon">
            <FileText size={14} strokeWidth={2.25} />
          </div>
          <div>
            <span className="step-label">Step 1</span>
            <h2>Review Job Description</h2>
          </div>
        </div>
        <button
          className={`text-button ${loadingJd ? 'is-loading' : ''}`}
          onClick={onExtract}
          disabled={loadingJd}
          type="button"
        >
          <RefreshCw size={12} strokeWidth={2.5} />
          {loadingJd ? 'Extracting...' : 'Extract again'}
        </button>
      </div>

      <div className={`jd-editor-wrap ${scrollState.up ? 'can-scroll-up' : ''} ${scrollState.down ? 'can-scroll-down' : ''}`}>
        <textarea
          ref={textareaRef}
          className="jd-editor"
          value={jd}
          onChange={onJdChange}
          onScroll={updateScrollState}
          placeholder="The full detected job description will appear here. You can also paste or edit it."
          aria-label="Full job description"
        />
      </div>
      <div className="field-meta">
        <span className={jdStatus ? 'status-text' : ''}>{jdStatus || 'Edit the text before tailoring if needed.'}</span>
        <span>{jd.trim().length.toLocaleString()} characters</span>
      </div>
    </section>
  )
}
