import { ArrowRight, GitCompare, Minus } from 'lucide-react'

export default function ChangesCard({ resumeChanges }) {
  if (!resumeChanges) return null
  const allChanges = [...resumeChanges.summaryChanges, ...resumeChanges.experienceChanges]

  return (
    <section className="card changes-card">
      <div className="section-heading-left">
        <div className="section-icon">
          <GitCompare size={14} strokeWidth={2.25} />
        </div>
        <div>
          <span className="step-label">Step 5</span>
          <h2>Resume Change Preview</h2>
        </div>
      </div>
      <p className="change-count">{allChanges.length} rewritten items</p>
      {allChanges.slice(0, 8).map((change, index) => (
        <div className="change-item" key={`${change.location}-${index}`}>
          <strong>{change.location}</strong>
          <span className="change-before">
            <Minus size={11} strokeWidth={2.5} />
            {change.before}
          </span>
          <span className="change-after">
            <ArrowRight size={11} strokeWidth={2.5} />
            {change.after}
          </span>
        </div>
      ))}
    </section>
  )
}
