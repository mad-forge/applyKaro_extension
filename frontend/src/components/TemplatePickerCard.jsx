import { Check, LayoutTemplate } from 'lucide-react'
import { RESUME_TEMPLATES } from './resume-templates/index.js'

export default function TemplatePickerCard({ selectedTemplateId, onSelect }) {
  return (
    <section className="card">
      <div className="section-heading-left">
        <div className="section-icon">
          <LayoutTemplate size={14} strokeWidth={2.25} />
        </div>
        <div>
          <h2>Resume Template</h2>
        </div>
      </div>
      <div className="template-option-list">
        {RESUME_TEMPLATES.map((template) => {
          const isSelected = template.id === selectedTemplateId
          return (
            <button
              key={template.id}
              type="button"
              className={`template-option ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelect(template.id)}
              aria-pressed={isSelected}
            >
              <span className="template-option-check">
                {isSelected && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="template-option-text">
                <strong>{template.label}</strong>
                <span>{template.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
