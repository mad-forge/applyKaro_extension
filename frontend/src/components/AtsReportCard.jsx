import { AlertTriangle, CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react'

function ReportList({ title, items, tone = '' }) {
  if (!items?.length) return null
  const Icon = tone === 'matched' ? CheckCircle2 : tone === 'missing' ? XCircle : AlertTriangle
  return (
    <div className="report-group">
      <h3>
        <Icon size={11} strokeWidth={2.5} />
        {title}
      </h3>
      <div className="tag-list">
        {items.map((item) => <span className={`report-tag ${tone}`} key={item}>{item}</span>)}
      </div>
    </div>
  )
}

export default function AtsReportCard({ atsReport }) {
  return (
    <section className="card report-card">
      <div className="score-row">
        <div className="section-heading-left">
          <div className="section-icon">
            <ClipboardCheck size={14} strokeWidth={2.25} />
          </div>
          <div>
            <span className="step-label">Step 3</span>
            <h2>ATS Report</h2>
          </div>
        </div>
        <div className="score-badge" style={{ '--score': atsReport.atsScore.score }}>
          <span>{atsReport.atsScore.score}%</span>
        </div>
      </div>
      <ReportList title="Matched skills" items={atsReport.atsScore.matchedSkills.map((item) => item.skill)} tone="matched" />
      <ReportList title="Missing skills" items={atsReport.atsScore.missingSkills.map((item) => item.name)} tone="missing" />
      <ReportList title="Visibility gaps" items={atsReport.gapAnalysis.visibilityGaps.map((item) => item.term)} />
      <ReportList title="Wording gaps" items={atsReport.gapAnalysis.wordingGaps.map((item) => item.term)} />
      <ReportList title="Capability gaps" items={atsReport.gapAnalysis.capabilityGaps.map((item) => item.term)} tone="missing" />
    </section>
  )
}
