import { DefaultTemplate } from './DefaultTemplate.jsx'

// Registry for the upcoming template picker. Add new templates here as
// { id, label, description, Component } — the id is what gets persisted
// as the user's chosen template.
export const RESUME_TEMPLATES = [
  {
    id: 'default',
    label: 'Default',
    description: 'Classic LaTeX (Computer Modern) style with a framed page edge.',
    Component: DefaultTemplate,
  },
]

export const DEFAULT_TEMPLATE_ID = 'default'

export function getResumeTemplate(id) {
  return RESUME_TEMPLATES.find((template) => template.id === id) || RESUME_TEMPLATES[0]
}
