import { Trash2, Upload } from 'lucide-react'

export default function ResumeUploadCard({ resumeFile, resumeSyncStatus, savedResumeMeta, onFileChange, onClear }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div className="section-heading-left">
          <div className="section-icon">
            <Upload size={14} strokeWidth={2.25} />
          </div>
          <div>
            <span className="step-label">Step 2</span>
            <h2>Upload Base Resume</h2>
          </div>
        </div>
      </div>
      <label className="file-picker">
        <div className="file-picker-icon">
          <Upload size={15} strokeWidth={2.25} />
        </div>
        <span className="file-picker-label">{resumeFile ? 'Replace PDF' : 'Choose PDF'}</span>
        <strong className="file-picker-name">{resumeFile?.name || 'No resume selected'}</strong>
        <input type="file" accept=".pdf,application/pdf" onChange={onFileChange} />
      </label>
      <div className="resume-meta-row">
        <span>{resumeSyncStatus || 'Your selected resume will be remembered in this browser.'}</span>
        {savedResumeMeta && (
          <button className="text-button" type="button" onClick={onClear}>
            <Trash2 size={12} strokeWidth={2.5} />
            Forget
          </button>
        )}
      </div>
    </section>
  )
}
