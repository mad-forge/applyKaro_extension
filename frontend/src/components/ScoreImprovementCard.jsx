import { MoveRight, TrendingUp } from 'lucide-react'

export default function ScoreImprovementCard({ scoreImprovement }) {
  if (!scoreImprovement) return null
  const { before, after } = scoreImprovement
  const delta = after - before

  return (
    <section className="card score-improvement-card">
      <div className="section-heading-left">
        <div className="section-icon">
          <TrendingUp size={14} strokeWidth={2.25} />
        </div>
        <div>
          <span className="step-label">ATS Match</span>
          <h2>Score Improvement</h2>
        </div>
      </div>
      <div className="score-compare">
        <div className="score-compare-item">
          <div className="score-badge is-before" style={{ '--score': before }}>
            <span>{before}%</span>
          </div>
          <p>Before</p>
        </div>
        <MoveRight size={20} strokeWidth={2.5} className="score-compare-arrow" />
        <div className="score-compare-item">
          <div className="score-badge is-after" style={{ '--score': after }}>
            <span>{after}%</span>
          </div>
          <p>After</p>
        </div>
        {delta !== 0 && (
          <span className={`score-delta ${delta > 0 ? 'is-positive' : 'is-negative'}`}>
            {delta > 0 ? '+' : ''}{delta} pts
          </span>
        )}
      </div>
    </section>
  )
}
