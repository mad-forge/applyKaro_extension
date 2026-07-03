import { CheckCircle2, Sparkles } from 'lucide-react'

export default function KeywordsCard({ keywordsData }) {
  if (!keywordsData?.length) return null
  return (
    <section className="card success-card">
      <div className="section-heading-left">
        <div className="section-icon">
          <Sparkles size={14} strokeWidth={2.25} />
        </div>
        <h2>Keywords incorporated</h2>
      </div>
      <ul className="keyword-list">
        {keywordsData.map((item, index) => (
          <li key={`${item.keyword}-${index}`}>
            <strong>
              <CheckCircle2 size={12} strokeWidth={2.5} />
              {item.keyword}
            </strong>
            <span>{item.location}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
