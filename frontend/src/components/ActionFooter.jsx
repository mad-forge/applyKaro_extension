import { ArrowLeft, Download, Loader2, Sparkles, Wand2 } from 'lucide-react'

export default function ActionFooter({
  step,
  resultMessage,
  isProcessing,
  loadingJd,
  processingSeconds,
  canContinueFromJd,
  pdfBlobUrl,
  tailoredData,
  onBack,
  onContinueJd,
  onAnalyze,
  onTailor,
  onDownload,
  onStartOver,
}) {
  return (
    <footer className="action-panel">
      {resultMessage && <p className="result-message" role="status">{resultMessage}</p>}

      <div className="footer-actions">
        {step > 1 && (
          <button className="ghost-button" type="button" onClick={onBack} disabled={isProcessing}>
            <ArrowLeft size={14} strokeWidth={2.5} />
            Back
          </button>
        )}

        {step === 1 && (
          <button
            className="primary-button"
            type="button"
            onClick={onContinueJd}
            disabled={loadingJd || !canContinueFromJd}
          >
            Continue
          </button>
        )}

        {step === 2 && (
          <button
            className={`primary-button ${isProcessing ? 'is-loading' : ''}`}
            type="button"
            onClick={onAnalyze}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 size={16} strokeWidth={2.5} /> : <Sparkles size={16} strokeWidth={2.5} />}
            {isProcessing ? 'Analyzing resume...' : 'Analyze ATS Match'}
          </button>
        )}

        {step === 3 && (
          <button
            className={`primary-button ${isProcessing ? 'is-loading' : ''}`}
            type="button"
            onClick={onTailor}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 size={16} strokeWidth={2.5} /> : <Wand2 size={16} strokeWidth={2.5} />}
            {isProcessing ? `Tailoring resume... ${processingSeconds}s` : 'Generate Tailored Resume'}
          </button>
        )}

        {step === 4 && pdfBlobUrl && tailoredData && (
          <button className="primary-button download-button" type="button" onClick={onDownload}>
            <Download size={16} strokeWidth={2.5} />
            Download Tailored PDF
          </button>
        )}
      </div>

      {step === 4 && pdfBlobUrl && (
        <button className="text-button start-over-link" type="button" onClick={onStartOver}>
          Tailor for another job
        </button>
      )}

      {isProcessing && (
        <p className="processing-note">Analyzing the full JD and generating your PDF. This can take a couple of minutes.</p>
      )}
    </footer>
  )
}
