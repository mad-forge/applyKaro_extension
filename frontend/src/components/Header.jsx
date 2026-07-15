import brandLogo from '../assets/brand-logo.png'
import { ExternalLink, Sparkles, UserRound } from 'lucide-react'

const LANDING_PAGE_URL = 'http://localhost:3001'

export default function Header({ userEmail }) {
  return (
    <header className="app-header">
      <div className="app-mark">
        <img src={brandLogo} alt="Brand Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div className="app-header-text">
        <p className="eyebrow">
          <Sparkles size={11} strokeWidth={2.5} />
          ATS resume assistant
        </p>
        <h1>AI Resume Tailor</h1>
        <p className="subtitle">Review the complete job description, then tailor your resume.</p>
        {userEmail && (
          <p className="account-line">
            <UserRound size={11} strokeWidth={2.5} />
            {userEmail}
          </p>
        )}
      </div>
      <a
        className="landing-link"
        href={LANDING_PAGE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Visit the ApplyKro website"
      >
        <ExternalLink size={14} strokeWidth={2.5} />
      </a>
    </header>
  )
}
