import { Check } from 'lucide-react'

const STEPS = [
  { id: 1, label: 'Job' },
  { id: 2, label: 'Resume' },
  { id: 3, label: 'Report' },
  { id: 4, label: 'Result' },
]

export default function Stepper({ step, maxUnlockedStep, onStepClick }) {
  return (
    <ol className="stepper">
      {STEPS.map((item, index) => {
        const isCompleted = item.id < step
        const isCurrent = item.id === step
        const isReachable = item.id <= maxUnlockedStep

        return (
          <li className="stepper-cell" key={item.id}>
            <div className="stepper-row">
              <button
                type="button"
                className={`stepper-node ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-completed' : ''}`}
                onClick={() => onStepClick(item.id)}
                disabled={!isReachable}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <Check size={13} strokeWidth={3} /> : item.id}
              </button>
              {index < STEPS.length - 1 && (
                <span className={`stepper-line ${item.id < step ? 'is-completed' : ''}`} />
              )}
            </div>
            <span className={`stepper-label ${isCurrent ? 'is-current' : ''}`}>{item.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
