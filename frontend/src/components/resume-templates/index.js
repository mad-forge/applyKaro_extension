// Registry for the template picker. Add new templates here as
// { id, label, description, load } — the id is what gets persisted as the
// user's chosen template. `load` is a dynamic import so picking a template
// in the UI never has to pull @react-pdf/renderer (and its fonts) into the
// bundle — that only happens once, at PDF-generation time.
export const RESUME_TEMPLATES = [
  {
    id: 'latex-classic',
    label: 'LaTeX Classic',
    description: 'Times New Roman, plain page, small-caps section rules — the classic Overleaf resume look.',
    load: () => import('./LatexClassicTemplate.jsx').then((module) => module.LatexClassicTemplate),
  },
  {
    id: 'default',
    label: 'Computer Modern',
    description: 'Classic LaTeX (Computer Modern) style with a framed page edge.',
    load: () => import('./DefaultTemplate.jsx').then((module) => module.DefaultTemplate),
  },
  {
    id: 'modern-navy',
    label: 'Modern Navy',
    description: 'Helvetica with a navy accent, two-column header, and ruled section headings.',
    load: () => import('./ModernNavyTemplate.jsx').then((module) => module.ModernNavyTemplate),
  },
  {
    id: 'palatino-classic',
    label: 'Classic Serif (Centered)',
    description: 'Small-caps centered header, serif body — a refined classic look.',
    load: () => import('./PalatinoClassicTemplate.jsx').then((module) => module.PalatinoClassicTemplate),
  },
]

export const DEFAULT_TEMPLATE_ID = 'latex-classic'

export function getResumeTemplateMeta(id) {
  return RESUME_TEMPLATES.find((template) => template.id === id) || RESUME_TEMPLATES[0]
}
