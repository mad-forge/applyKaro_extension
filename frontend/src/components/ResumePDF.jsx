// Backward-compatible entry point: App.jsx dynamically imports this path to
// generate the downloaded PDF. Real templates live in ./resume-templates —
// add new ones to the registry there, not here.
export { DefaultTemplate as ResumePDF } from './resume-templates/DefaultTemplate.jsx'
