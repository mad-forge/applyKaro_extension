import brandLogo from '../assets/brand-logo.png'
import { Sparkles, UserRound } from 'lucide-react'

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
    </header>
  )
}
