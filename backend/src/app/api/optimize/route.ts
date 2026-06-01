import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_RESUME_LATEX_TEMPLATE } from "@/lib/default-resume-template"
import { buildResumeTemplateDataFromText, renderResumeLatex, type ResumeTemplateData } from "@/lib/dynamic-resume-template"

const getAIConfig = () => {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    model: process.env.AI_MODEL || "gpt-4o-mini"
  }
}

const optimizerPrompt = `You are InterviewMint's senior ATS resume strategist.
You will receive:\n1) A base resume\n2) The original resume page count\n3) A job description

Return ONLY strict JSON with this exact schema:
{
  "missing_keywords": string[],
  "ats_score_out_of_100": number,
  "optimized_resume_text": string,
  "optimized_resume_data": {
    "name": string,
    "location": string,
    "phone": string,
    "email": string,
    "github": string,
    "linkedin": string,
    "portfolio": string,
    "summary": string,
    "skills": {
      "languages": string[],
      "frontend": string[],
      "backend_tools": string[],
      "libraries": string[],
      "testing": string[],
      "data": string[]
    },
    "experience": [
      {
        "title": string,
        "company": string,
        "location": string,
        "duration": string,
        "points": string[]
      }
    ],
    "projects": [
      {
        "title": string,
        "stack": string,
        "points": string[]
      }
    ],
    "certifications": string[],
    "education": [
      {
        "degree": string,
        "institution": string,
        "duration": string
      }
    ]
  },
  "keyword_injection_plan": string[],
  "change_log": [
    {
      "section": string,
      "before": string,
      "after": string,
      "reason": string
    }
  ],
  "rewritten_bullet_points": [
    {
      "original": string,
      "optimized": string
    }
  ],
  "optimized_latex_resume": string
}

Rules:
- Make minimal, targeted ATS edits. Do not rewrite the whole resume unless absolutely necessary.
- Preserve the user's original structure, order, tone, headings, education, college/school entries, projects, employers, dates, and page-length intent.
- If ORIGINAL_PAGE_COUNT is 2 or more, preserve a detailed 2-page resume style. Do not compress it into a short one-page resume.
- If ORIGINAL_PAGE_COUNT is 1, keep it concise enough for one page.
- Focus changes on summary/profile, skills, and selected experience bullets only.
- First analyze the job description deeply: role mission, required technologies, must-have keywords, responsibilities, domain words, seniority signals, and soft-skill signals.
- Then analyze the resume for evidence that can support those requirements.
- Add the strongest supported job-description keywords naturally where the resume already supports them, especially in Skills, Summary, and Experience bullets.
- Use exact generic keywords from the job description when they are truthful for the resume, such as coding, debugging, software development, application development, frontend, backend, testing, troubleshooting, optimization, teamwork, and communication.
- Place keywords where they belong: technologies in Skills, role/process keywords in Summary, and responsibility keywords inside relevant Experience bullets.
- Never add a standalone keyword-dump line such as "Role-fit keywords", "Targeted ATS Keywords", or "Target role alignment".
- Prioritize keywords that ATS systems often rank highly: exact technology names, role title terms, responsibilities, standards, workflows, and domain phrases from the job post.
- Reorder or tighten skills so the most job-relevant skills appear early.
- Make experience bullets sharper and closer to the job description while preserving truth.
- Do not add fake tools, fake projects, fake education, fake companies, fake achievements, or fake years of experience.
- Do not edit school, college, education, certification, or project sections except for tiny formatting cleanup.
- Optimize for keyword coverage, role relevance, action verbs, measurable outcomes, and recruiter readability.
- missing_keywords: 8-25 concrete keywords from the job description absent or weak in the resume.
- ats_score_out_of_100: integer from 0 to 100 after optimization. Be realistic.
- optimized_resume_text: the user's resume with only the targeted ATS edits applied.
- optimized_resume_data: structured JSON resume data matching the schema above. Use this as the canonical download/export data.
- keyword_injection_plan: concise notes explaining which keywords were added and where.
- change_log: every meaningful change you made, with before/after and why.
- rewritten_bullet_points: 5-10 optimized bullets with quantified impact where possible.
- Keep every claim truthful and aligned to the original resume. Do not invent employers, degrees, certifications, years of experience, or tools not supported by the base resume.
- Never insert the target company name into Summary/Experience/Projects unless that exact company already exists in the original base resume text.
- If a keyword is important but not supported by the resume, mention it in missing_keywords instead of fabricating it.
- Do not include markdown, prose, or code fences.
- Output valid parseable JSON only.`

const importantTerms = [
  "Software Development",
  "Application Development",
  "Programming",
  "Coding",
  "Debugging",
  "Feature Enhancement",
  "Software Testing",
  "Troubleshooting",
  "Optimization",
  "Frontend Development",
  "Backend Development",
  "Module Development",
  "Code Review",
  "Documentation",
  "Development Workflows",
  "Technical Problem-Solving",
  "Logic Building",
  "Communication",
  "Teamwork",
  "Adaptability",
  "Java",
  "Go",
  "Kotlin",
  "Object-Oriented Design",
  "Design Patterns",
  "Data Structures",
  "Algorithms",
  "Distributed Systems",
  "Event-Driven Architecture",
  "Kafka",
  "RabbitMQ",
  "Low-Level Design",
  "LLD",
  "Code Review",
  "Unit Testing",
  "Contract Testing",
  "Component Testing",
  "Observability",
  "On-call",
  "RCA",
  "Performance Optimization",
  "Backend Systems",
  "API Security",
  "Peer Reviews",
  "Clean Code",
  "Troubleshooting",
  "React",
  "React Native",
  "TypeScript",
  "JavaScript",
  "Bun",
  "Monorepo",
  "REST APIs",
  "RESTful APIs",
  "Node.js",
  "Python",
  "HTML5",
  "CSS3",
  "responsive design",
  "accessibility",
  "WCAG",
  "performance",
  "security",
  "Agile",
  "Scrum",
  "CI/CD",
  "testing",
  "debugging",
  "JSON",
  "XML",
  "Git",
  "frontend",
  "backend",
  "web applications",
  "user experience",
  "digital learning",
  "Redux",
  "Redux Toolkit",
  "RTK Query",
  "Tailwind CSS",
  "GraphQL",
  "Next.js",
  "Jest",
  "Cypress",
  "Playwright",
  "Microservices",
  "Docker",
  "Kubernetes",
  "AWS"
]

const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)))
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+.#]/g, "")
const latexEscape = (value: string) =>
  value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")

const backendPriorityTerms = [
  "Java",
  "Go",
  "Kotlin",
  "Object-Oriented Design",
  "Design Patterns",
  "Data Structures",
  "Algorithms",
  "Backend Systems",
  "Distributed Systems",
  "Event-Driven Architecture",
  "Kafka",
  "RabbitMQ",
  "Low-Level Design",
  "LLD",
  "Unit Testing",
  "Contract Testing",
  "Component Testing",
  "Code Reviews",
  "Agile",
  "Observability",
  "On-call",
  "RCA",
  "Performance Optimization",
  "API Security",
  "Troubleshooting"
]

const genericJdTerms = [
  "Software Developer",
  "Software Developer Intern",
  "Entry Level",
  "Software Development",
  "Application Development",
  "Programming",
  "Coding",
  "Debugging",
  "Feature Enhancement",
  "Software Testing",
  "Troubleshooting",
  "Optimization",
  "Frontend Development",
  "Backend Development",
  "Module Development",
  "Code Review",
  "Code Reviews",
  "Documentation",
  "Development Workflows",
  "Technical Problem-Solving",
  "Problem-Solving",
  "Logic Building",
  "Analytical Mindset",
  "Technical Curiosity",
  "Communication",
  "Teamwork",
  "Adaptability",
  "Project-Based Learning",
  "Remote"
]

const cleanKeyword = (value: string) =>
  value
    .replace(/^[•\-*]\s*/, "")
    .replace(/\(e\.g\.[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()

const isLikelyCompanyKeyword = (term: string, company?: string) => {
  const cleaned = cleanKeyword(term)
  if (!cleaned) return true
  if (cleaned.length < 3) return true
  if (company && normalize(cleaned) === normalize(company)) {
    return true
  }
  if (/\b(apply|hiring|stipend|certificate|benefits?|perks?|duration|virtual|remote|month|freshers?|students?)\b/i.test(cleaned)) {
    return true
  }
  return false
}

const extractJdKeywords = (jobDescription: string, company?: string) => {
  const jd = jobDescription.toLowerCase()
  const exact = importantTerms.filter((term) => jd.includes(term.toLowerCase()))
  const genericExact = genericJdTerms.filter((term) => jd.includes(term.toLowerCase()))

  const lines = jobDescription
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const mustHaveBlock: string[] = []
  let inMustHave = false
  for (const line of lines) {
    if (/^must haves?/i.test(line) || /^skills$/i.test(line)) {
      inMustHave = true
      continue
    }
    if (inMustHave && /^(preferred|inside|our culture|why you'll thrive|about|education|experience)/i.test(line)) {
      inMustHave = false
    }
    if (inMustHave) mustHaveBlock.push(cleanKeyword(line))
  }

  const priorityHits = backendPriorityTerms.filter((term) =>
    [...mustHaveBlock, ...lines].some((line) => line.toLowerCase().includes(term.toLowerCase()))
  )

  const phraseMatches =
    jobDescription.match(/\b([A-Z][a-zA-Z0-9+#.-]{2,}(?:\s+[A-Z][a-zA-Z0-9+#.-]{2,}){0,3})\b/g)?.map(cleanKeyword) || []
  const normalizedPhraseMatches = phraseMatches.filter((p) =>
    /(java|go|kotlin|design|pattern|data structure|algorithm|backend|distributed|kafka|rabbitmq|security|testing|review|observability|on-call|rca|lld|api|agile)/i.test(
      p
    )
  )

  return uniq([...genericExact, ...priorityHits, ...exact, ...mustHaveBlock, ...normalizedPhraseMatches])
    .map(cleanKeyword)
    .filter((keyword) => keyword.length >= 2 && !isLikelyCompanyKeyword(keyword, company))
    .slice(0, 35)
}

const sectionOrder = ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "CERTIFICATIONS", "EDUCATION"]

const sectionAliases: Record<string, string> = {
  SUMMARY: "SUMMARY",
  PROFILE: "SUMMARY",
  "PROFESSIONAL SUMMARY": "SUMMARY",
  "CAREER SUMMARY": "SUMMARY",
  OBJECTIVE: "SUMMARY",
  SKILLS: "SKILLS",
  "TECHNICAL SKILLS": "SKILLS",
  "CORE SKILLS": "SKILLS",
  TECHNOLOGIES: "SKILLS",
  EXPERIENCE: "EXPERIENCE",
  "WORK EXPERIENCE": "EXPERIENCE",
  "PROFESSIONAL EXPERIENCE": "EXPERIENCE",
  EMPLOYMENT: "EXPERIENCE",
  INTERNSHIPS: "EXPERIENCE",
  PROJECTS: "PROJECTS",
  "PERSONAL PROJECTS": "PROJECTS",
  "ACADEMIC PROJECTS": "PROJECTS",
  CERTIFICATIONS: "CERTIFICATIONS",
  CERTIFICATES: "CERTIFICATIONS",
  ACHIEVEMENTS: "CERTIFICATIONS",
  EDUCATION: "EDUCATION",
  ACADEMICS: "EDUCATION",
  "ACADEMIC BACKGROUND": "EDUCATION"
}

const normalizeHeading = (line: string) => {
  const cleaned = line
    .replace(/[:\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
  return sectionAliases[cleaned]
}

const normalizeResumeLine = (line: string) =>
  line
    .replace(/\r/g, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()

const isLikelyDateLine = (line: string) => {
  const cleaned = normalizeResumeLine(line)
  if (!cleaned) return false
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(cleaned)) return true
  if (/^(till now|present)$/i.test(cleaned.replace(/^[•-]\s*/, ""))) return true
  if (/^\d{4}\s*[-–]\s*(\d{2,4}|present)$/i.test(cleaned)) return true
  return false
}

const isLikelyContactLine = (line: string) =>
  /@|linkedin|github|portfolio|phone|\+?\d[\d\s().-]{7,}/i.test(normalizeResumeLine(line))

const isLikelyNameLine = (line: string) => {
  const cleaned = normalizeResumeLine(line)
  if (!cleaned || cleaned.length > 48) return false
  if (isLikelyDateLine(cleaned) || isLikelyContactLine(cleaned)) return false
  if (normalizeHeading(cleaned)) return false
  if (!/^[A-Za-z][A-Za-z\s.'-]+$/.test(cleaned)) return false
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  return words.every((word) => word.length >= 2)
}

const splitResumeIntoSections = (text: string) => {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeResumeLine(line))
    .filter(Boolean)

  const sections: Record<string, string[]> = { HEADER: [] }
  let current = "HEADER"
  let foundSection = false

  for (const line of lines) {
    const heading = normalizeHeading(line)
    if (heading) {
      current = heading
      foundSection = true
      if (!sections[current]) sections[current] = []
      continue
    }
    if (!sections[current]) sections[current] = []
    sections[current].push(line)
  }

  if (!foundSection && sections.HEADER.length) {
    const headerLines = sections.HEADER
    const contentStart = Math.min(
      headerLines.length,
      Math.max(
        1,
        headerLines.findIndex((line, index) => index > 0 && !/@|linkedin|github|portfolio|phone|\+?\d[\d\s().-]{7,}/i.test(line))
      )
    )
    sections.HEADER = headerLines.slice(0, contentStart)
    sections.SUMMARY = headerLines.slice(contentStart)
  }

  return sections
}

const cleanResumeLine = (line: string) => line.replace(/^[•*-]\s*/, "").trim()

const toHref = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url
  if (/^github\.com|^linkedin\.com/i.test(url)) return `https://${url}`
  return url
}

const buildResumeHeader = (headerLines: string[]) => {
  const topHeader = headerLines.slice(0, 14).map(normalizeResumeLine).filter(Boolean)
  const fallbackName = "Your Name"
  const uppercaseName = topHeader.find((line) => isLikelyNameLine(line) && line === line.toUpperCase())
  const mixedCaseName = topHeader.find((line) => isLikelyNameLine(line))
  const name = uppercaseName || mixedCaseName || fallbackName
  const contactText = topHeader.filter((line) => line !== name).join(" | ")
  const email = contactText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const phone = contactText.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]
  const github = contactText.match(/(?:https?:\/\/)?github\.com\/[A-Za-z0-9_.-]+/i)?.[0]
  const linkedin = contactText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_.-]+\/?/i)?.[0]
  const portfolio = contactText
    .split(/[|,]/)
    .map((part) => part.trim())
    .find((part) => /(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}/i.test(part) && !/@|github\.com|linkedin\.com/i.test(part))
  const locationLine = topHeader.find(
    (line) =>
      !isLikelyDateLine(line) &&
      !isLikelyContactLine(line) &&
      line !== name &&
      /[A-Za-z]+,\s*[A-Za-z]+/.test(line) &&
      line.length < 56
  )

  const firstLine = [
    locationLine,
    phone ? `Phone: ${phone}` : "",
    email ? `Email: \\href{mailto:${latexEscape(email)}}{\\underline{${latexEscape(email)}}}` : ""
  ]
    .filter(Boolean)
    .join(" $|$ ")
  const linkLine = [
    github ? `GitHub: \\href{${latexEscape(toHref(github))}}{\\underline{${latexEscape(github.replace(/^https?:\/\//i, ""))}}}` : "",
    linkedin
      ? `LinkedIn: \\href{${latexEscape(toHref(linkedin))}}{\\underline{${latexEscape(linkedin.replace(/^https?:\/\//i, ""))}}}`
      : "",
    portfolio
      ? `Portfolio: \\href{${latexEscape(toHref(portfolio))}}{\\underline{${latexEscape(portfolio.replace(/^https?:\/\//i, ""))}}}`
      : ""
  ]
    .filter(Boolean)
    .join(" $|$ ")

  return `\\begin{center}
    {\\Huge \\textbf{${latexEscape(name)}}} \\\\ \\vspace{2pt}
    ${firstLine ? `\\small ${firstLine} \\\\ \\vspace{2pt}` : "\\small Add contact details from your resume \\\\ \\vspace{2pt}"}
    ${linkLine || "\\textit{Add portfolio, GitHub, or LinkedIn links from your resume}"}
\\end{center}`
}

const formatSkillLine = (line: string) => {
  const cleaned = cleanResumeLine(normalizeResumeLine(line)).replace(/^\*+|\*+$/g, "")
  const [label, ...rest] = cleaned.split(":")
  if (rest.length && label.length <= 32) {
    return `\\textbf{${latexEscape(label)}:} ${latexEscape(rest.join(":").trim())} \\\\`
  }
  return `${latexEscape(cleaned)} \\\\`
}

const formatResumeLines = (lines: string[]) => {
  if (!lines.length) return ""
  const output: string[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (!bullets.length) return
    output.push(`\\begin{itemize}
${bullets.map((line) => `    \\item ${latexEscape(cleanResumeLine(line))}`).join("\n")}
\\end{itemize}`)
    bullets = []
  }

  for (const line of lines) {
    if (/^[•*-]\s*/.test(line)) {
      bullets.push(line)
      continue
    }
    flushBullets()
    output.push(`${latexEscape(line)} \\\\`)
  }

  flushBullets()
  return output.join("\n")
}

const buildStrictLatexFromResume = (resumeText: string) => {
  const sections = splitResumeIntoSections(resumeText)
  const header = buildResumeHeader(sections.HEADER || [])
  const summary = (sections.SUMMARY || []).map((line) => latexEscape(line)).join(" ")
  const skillsRaw = sections.SKILLS || []
  const skillsLines = skillsRaw.length
    ? skillsRaw.map(formatSkillLine).join("\n")
    : "\\textbf{Detail:} \\textit{Update from base resume.}"

  const experience = formatResumeLines(sections.EXPERIENCE || [])
  const projects = formatResumeLines(sections.PROJECTS || [])
  const certs = formatResumeLines(sections.CERTIFICATIONS || [])
  const education = formatResumeLines(sections.EDUCATION || [])

  return DEFAULT_RESUME_LATEX_TEMPLATE
    .replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/, header)
    .replace(
      /\\section\{Summary\}[\s\S]*?\\section\{Skills\}/,
      `\\section{Summary}
${summary || "\\textit{Updated from uploaded resume content.}"}

\\section{Skills}`
    )
    .replace(
      /\\section\{Skills\}[\s\S]*?\\section\{Experience\}/,
      `\\section{Skills}
\\noindent
${skillsLines}

\\section{Experience}`
    )
    .replace(
      /\\section\{Experience\}[\s\S]*?\\section\{Projects\}/,
      `\\section{Experience}
${experience || "\\textit{Experience updated from base resume.}"}

\\section{Projects}`
    )
    .replace(
      /\\section\{Projects\}[\s\S]*?\\section\{Certifications\}/,
      `\\section{Projects}
${projects || "\\textit{Projects updated from base resume.}"}

\\section{Certifications}`
    )
    .replace(
      /\\section\{Certifications\}[\s\S]*?\\section\{Education\}/,
      `\\section{Certifications}
${certs || "\\begin{itemize}\n    \\item \\textit{Updated from base resume}\n\\end{itemize}"}

\\section{Education}`
    )
    .replace(
      /\\section\{Education\}[\s\S]*?\\end\{document\}/,
      `\\section{Education}
${education || "\\textit{Education updated from base resume.}"}

\\end{document}`
    )
}

const collectResumeBullets = (lines: string[]) =>
  lines
    .filter((line) => /^[•*-]\s+/.test(line.trim()))
    .map((line) => line.replace(/^[•*-]\s+/, "").trim())
    .filter(Boolean)

const improveBullet = (bullet: string, supportedKeywords: string[]) => {
  let improved = bullet
  const hasMetric = /\d+[%xkK+]|\b(improved|reduced|increased|optimized)\b/i.test(bullet)
  if (!hasMetric) {
    improved = improved.replace(/\.$/, "")
    improved = `${improved}, improving delivery speed and production reliability.`
  }
  const keywordToInject = supportedKeywords.find(
    (k) => !new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(improved)
  )
  if (keywordToInject) {
    improved = improved.replace(/\.$/, "")
    improved = `${improved} using ${keywordToInject}.`
  }
  return improved
}

const createTermMatcher = (term: string) => new RegExp(`(^|[^a-z0-9])${normalize(term)}([^a-z0-9]|$)`, "i")

const skillKeywordPattern =
  /\b(java|javascript|typescript|python|c\+\+|go|kotlin|react|next\.js|node\.js|redux|tailwind|html5|css3|graphql|rest|api|apis|git|docker|kubernetes|aws|frontend|backend|testing|debugging|coding|programming)\b/i
const summaryKeywordPattern =
  /\b(software development|application development|problem-solving|technical problem-solving|logic building|communication|teamwork|adaptability|analytical mindset|technical curiosity|development workflows|documentation)\b/i
const bulletKeywordPattern =
  /\b(feature enhancement|debugging|testing|troubleshooting|optimization|code review|code reviews|module development|application support|documentation)\b/i

const hasKeyword = (text: string, keyword: string) => createTermMatcher(keyword).test(normalize(text))

const findMissingKeywordsForText = (text: string, keywords: string[]) =>
  keywords.filter((keyword) => !hasKeyword(text, keyword))

const categorizeKeywords = (keywords: string[]) => {
  const skillKeywords = keywords.filter((keyword) => skillKeywordPattern.test(keyword))
  const summaryKeywords = keywords.filter((keyword) => summaryKeywordPattern.test(keyword))
  const bulletKeywords = keywords.filter((keyword) => bulletKeywordPattern.test(keyword))

  return {
    skillKeywords,
    summaryKeywords: summaryKeywords.length ? summaryKeywords : keywords.filter((keyword) => !skillKeywords.includes(keyword)),
    bulletKeywords
  }
}

const computeAtsScore = (jobDescription: string, resumeText: string, company?: string) => {
  const jdKeywords = extractJdKeywords(jobDescription, company)
  if (!jdKeywords.length) return 55

  const normalizedResume = normalize(resumeText)
  const lines = resumeText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const bulletCount = lines.filter((line) => /^[•*-]\s+/.test(line)).length

  const matches = jdKeywords.filter((keyword) => createTermMatcher(keyword).test(normalizedResume)).length
  const coverage = matches / jdKeywords.length
  const bulletStrength = Math.min(1, bulletCount / 8)
  const structureBonus = /SUMMARY/i.test(resumeText) && /SKILLS/i.test(resumeText) ? 1 : 0

  const rawScore = 38 + coverage * 48 + bulletStrength * 10 + structureBonus * 4
  return Math.max(0, Math.min(100, Math.round(rawScore)))
}

const sanitizeOptimizedResumeText = (text: string) => {
  return text
    .replace(/\r/g, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s*Target role alignment:[^.]*\./gi, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trimEnd())
    .filter((line) => !/^\s*(Role-fit keywords|Targeted ATS Keywords)\s*:/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const isGenericSafeKeyword = (term: string) =>
  genericJdTerms.some((generic) => normalize(generic) === normalize(term))

const findUnsupportedInsertedTerms = (
  originalResume: string,
  optimizedResume: string,
  jobDescription: string,
  company?: string
) =>
  uniq(extractJdKeywords(jobDescription, company))
    .filter((term) => skillKeywordPattern.test(term))
    .filter((term) => !isGenericSafeKeyword(term))
    .filter((term) => !hasKeyword(originalResume, term) && hasKeyword(optimizedResume, term))

const findUnsupportedIdentityTerms = (originalResume: string, optimizedResume: string, company?: string) => {
  const original = normalize(originalResume)
  const optimized = normalize(optimizedResume)
  const suspiciousTerms = uniq([
    company || "",
    "Alex Morgan",
    "alexmorgan",
    "John Doe",
    "ABC Tech",
    "Example Technologies",
    "Example Institute",
    "Example Academy",
    "Sample Learning",
    "Sample Public School",
    "Demo Digital Studio",
    "Demo Institute",
    "New Delhi",
    "Bengaluru",
    "Remote",
    "B.Tech",
    "12th Science",
    "Google Data Analytics",
    "HackerRank SQL"
  ])

  return suspiciousTerms.filter((term) => {
    const normalizedTerm = normalize(term)
    return normalizedTerm && optimized.includes(normalizedTerm) && !original.includes(normalizedTerm)
  })
}

const isBadGeneratedText = (value: string) =>
  /\b(Target role alignment|Role-fit keywords|Targeted ATS Keywords)\b/i.test(value)

const buildChangeReason = (section: string) => {
  if (/summary/i.test(section)) return "Tightened the summary for clearer role alignment without changing the candidate's background."
  if (/skills?/i.test(section)) return "Kept skills aligned with evidence already present in the resume."
  if (/experience|bullet/i.test(section)) return "Made the existing experience bullet closer to the job responsibility while preserving truth."
  return "Applied a targeted ATS readability improvement."
}

const sanitizeChangeLog = (
  changeLog: Array<{ section: string; before: string; after: string; reason: string }>,
  fallback: Array<{ section: string; before: string; after: string; reason: string }>
) => {
  const cleaned = changeLog
    .filter((item) => item.after && ![item.before, item.after, item.reason].some(isBadGeneratedText))
    .map((item) => ({
      ...item,
      reason: item.reason || buildChangeReason(item.section)
    }))
  return cleaned.length ? cleaned : fallback
}

const toStringList = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : []

const normalizeResumeData = (value: any, fallback: ResumeTemplateData): ResumeTemplateData => {
  if (!value || typeof value !== "object") return fallback

  const skills = value.skills && typeof value.skills === "object" ? value.skills : {}
  type ExperienceItem = ResumeTemplateData["experience"][number]
  type ProjectItem = ResumeTemplateData["projects"][number]
  type EducationItem = ResumeTemplateData["education"][number]
  const experience = Array.isArray(value.experience)
    ? value.experience
        .map((item: any) => ({
          title: String(item?.title ?? "").trim(),
          company: String(item?.company ?? "").trim(),
          location: String(item?.location ?? "").trim(),
          duration: String(item?.duration ?? "").trim(),
          points: toStringList(item?.points)
        }))
        .filter((item: ExperienceItem) => item.title || item.company || item.points.length)
    : fallback.experience
  const projects = Array.isArray(value.projects)
    ? value.projects
        .map((item: any) => ({
          title: String(item?.title ?? "").trim(),
          stack: String(item?.stack ?? "").trim(),
          points: toStringList(item?.points)
        }))
        .filter((item: ProjectItem) => item.title || item.points.length)
    : fallback.projects
  const education = Array.isArray(value.education)
    ? value.education
        .map((item: any) => ({
          degree: String(item?.degree ?? "").trim(),
          institution: String(item?.institution ?? "").trim(),
          duration: String(item?.duration ?? "").trim()
        }))
        .filter((item: EducationItem) => item.degree || item.institution)
    : fallback.education

  return {
    name: String(value.name ?? fallback.name).trim() || fallback.name,
    phone: String(value.phone ?? fallback.phone ?? "").trim(),
    email: String(value.email ?? fallback.email ?? "").trim(),
    location: String(value.location ?? fallback.location ?? "").trim(),
    github: String(value.github ?? fallback.github ?? "").trim(),
    linkedin: String(value.linkedin ?? fallback.linkedin ?? "").trim(),
    portfolio: String(value.portfolio ?? fallback.portfolio ?? "").trim(),
    summary: String(value.summary ?? fallback.summary).trim() || fallback.summary,
    skills: {
      languages: toStringList(skills.languages).length ? toStringList(skills.languages) : fallback.skills.languages,
      frontend: toStringList(skills.frontend).length ? toStringList(skills.frontend) : fallback.skills.frontend,
      backend_tools: toStringList(skills.backend_tools).length ? toStringList(skills.backend_tools) : fallback.skills.backend_tools,
      libraries: toStringList(skills.libraries).length ? toStringList(skills.libraries) : fallback.skills.libraries,
      testing: toStringList(skills.testing).length ? toStringList(skills.testing) : fallback.skills.testing,
      data: toStringList(skills.data).length ? toStringList(skills.data) : fallback.skills.data
    },
    experience,
    projects,
    certifications: toStringList(value.certifications).length ? toStringList(value.certifications) : fallback.certifications,
    education
  }
}

const localOptimize = ({
  job_title,
  company,
  job_description,
  base_resume
}: {
  job_title?: string
  company?: string
  job_description: string
  base_resume: string
}) => {
  const resumeLower = base_resume.toLowerCase()
  const jdTerms = extractJdKeywords(job_description, company)
  const resumeTokens = new Set(
    resumeLower
      .split(/[\s,;/|()]+/)
      .map((t) => normalize(t))
      .filter(Boolean)
  )
  const supported = jdTerms.filter((term) => {
    const n = normalize(term)
    return n && (resumeLower.includes(term.toLowerCase()) || resumeTokens.has(n) || genericJdTerms.some((generic) => normalize(generic) === n))
  })
  const missing = jdTerms.filter((term) => !supported.includes(term))
  const score = Math.min(
    95,
    Math.max(30, computeAtsScore(job_description, base_resume, company))
  )

  const lines = base_resume.replace(/\r/g, "").split("\n").map((line) => line.replace(/\s+$/g, ""))
  const summaryIndex = lines.findIndex((line) => line.trim().toUpperCase() === "SUMMARY")
  const skillsIndex = lines.findIndex((line) => line.trim().toUpperCase() === "SKILLS")
  const safeSupported = uniq(supported).slice(0, 12)
  const { skillKeywords, summaryKeywords, bulletKeywords } = categorizeKeywords(safeSupported)
  const rolePhrase = `${job_title || "target role"}`
  const changeLog: Array<{ section: string; before: string; after: string; reason: string }> = []

  if (summaryIndex >= 0 && summaryKeywords.length >= 2) {
    const nextContentIndex = lines.findIndex((line, index) => index > summaryIndex && line.trim())
    if (nextContentIndex > summaryIndex) {
      const before = lines[nextContentIndex]
      const additions = findMissingKeywordsForText(before, summaryKeywords).slice(0, 3)
      const after = additions.length
        ? `${before.replace(/\.$/, "")}, with hands-on exposure to ${additions.join(", ")}.`
        : before
      lines[nextContentIndex] = after
      if (after !== before) {
        changeLog.push({
          section: "SUMMARY",
          before,
          after,
          reason: `Added JD keywords for ${rolePhrase} in natural summary language.`
        })
      }
    }
  }

  if (skillsIndex >= 0 && skillKeywords.length >= 2) {
    const skillLineIndex = lines.findIndex((line, index) => index > skillsIndex && line.trim())
    if (skillLineIndex > skillsIndex) {
      const before = lines[skillLineIndex]
      const additions = findMissingKeywordsForText(before, skillKeywords).slice(0, 6)
      const after = additions.length ? `${before.replace(/\.$/, "")}, ${additions.join(", ")}` : before
      lines[skillLineIndex] = after
      if (after !== before) {
        changeLog.push({
          section: "SKILLS",
          before,
          after,
          reason: "Placed JD technical keywords inside the existing skills line."
        })
      }
    }
  }

  if (bulletKeywords.length) {
    const bulletIndex = lines.findIndex((line) => /^[•*-]\s+/.test(line.trim()))
    if (bulletIndex >= 0) {
      const before = lines[bulletIndex]
      const additions = findMissingKeywordsForText(before, bulletKeywords).slice(0, 2)
      if (additions.length) {
        const after = `${before.replace(/\.$/, "")}, supporting ${additions.join(" and ")}.`
        lines[bulletIndex] = after
        changeLog.push({
          section: "EXPERIENCE",
          before,
          after,
          reason: "Added JD responsibility keywords inside an existing work bullet."
        })
      }
    }
  }

  const bullets = collectResumeBullets(lines)
  const rewritten = bullets.slice(0, 8).map((bullet) => ({
    original: bullet,
    optimized: improveBullet(bullet, safeSupported)
  }))

  const optimizedResumeText = sanitizeOptimizedResumeText(lines.join("\n"))
  const optimizedResumeData = buildResumeTemplateDataFromText(optimizedResumeText)

  return {
    missing_keywords: uniq(missing).slice(0, 20),
    ats_score_out_of_100: score,
    optimized_resume_text: optimizedResumeText,
    optimized_resume_data: optimizedResumeData,
    keyword_injection_plan: [
      safeSupported.length
        ? `Added supported keywords: ${safeSupported.join(", ")}`
        : "No safe supported keywords found to inject without inventing experience.",
      missing.length
        ? `Left unsupported keywords as missing instead of fabricating them: ${missing.slice(0, 8).join(", ")}`
        : "No major unsupported job keywords detected."
    ],
    change_log: changeLog,
    rewritten_bullet_points: rewritten,
    optimized_latex_resume: renderResumeLatex(optimizedResumeData)
  }
}

const normalizeOptimizePayload = (
  payload: any,
  fallback: ReturnType<typeof localOptimize>,
  originalResume: string,
  jobDescription: string,
  company?: string
) => {
  const missingKeywordsRaw =
    payload?.missing_keywords ??
    payload?.missingKeywords ??
    payload?.keywords_missing ??
    payload?.missing
  const missingKeywords = Array.isArray(missingKeywordsRaw)
    ? missingKeywordsRaw.map((item) => String(item).trim()).filter(Boolean)
    : fallback.missing_keywords

  const optimizedResumeRaw =
    payload?.optimized_resume_text ??
    payload?.optimizedResumeText ??
    payload?.optimized_resume ??
    payload?.optimizedText
  const optimizedResumeText =
    typeof optimizedResumeRaw === "string" && optimizedResumeRaw.trim().length > 0
      ? optimizedResumeRaw
      : fallback.optimized_resume_text || originalResume
  const sanitizedOptimizedResumeText = sanitizeOptimizedResumeText(optimizedResumeText)
  const unsupportedInsertedTerms = findUnsupportedInsertedTerms(
    originalResume,
    sanitizedOptimizedResumeText,
    jobDescription,
    company
  )
  const unsupportedIdentityTerms = findUnsupportedIdentityTerms(
    originalResume,
    sanitizedOptimizedResumeText,
    company
  )
  const shouldUseFallback = unsupportedInsertedTerms.length || unsupportedIdentityTerms.length
  const finalOptimizedResumeText = shouldUseFallback
    ? fallback.optimized_resume_text
    : sanitizedOptimizedResumeText

  const score = computeAtsScore(jobDescription, finalOptimizedResumeText, company)

  const keywordPlanRaw = payload?.keyword_injection_plan ?? payload?.keywordPlan ?? payload?.injection_plan
  const keywordPlan = shouldUseFallback
    ? [
        ...fallback.keyword_injection_plan,
        unsupportedInsertedTerms.length
          ? `Rejected unsupported AI-added skills: ${unsupportedInsertedTerms.join(", ")}`
          : "",
        unsupportedIdentityTerms.length
          ? `Rejected unsupported AI-added profile/company data: ${unsupportedIdentityTerms.join(", ")}`
          : ""
      ]
        .filter(Boolean)
    : Array.isArray(keywordPlanRaw)
    ? keywordPlanRaw.map((item) => String(item).trim()).filter(Boolean)
    : fallback.keyword_injection_plan

  const rewrittenRaw = payload?.rewritten_bullet_points ?? payload?.rewrittenBullets ?? payload?.bullet_rewrites
  const rewritten = shouldUseFallback
    ? fallback.rewritten_bullet_points
    : Array.isArray(rewrittenRaw)
    ? rewrittenRaw
        .map((item: any) => ({
          original: String(item?.original ?? "").trim(),
          optimized: String(item?.optimized ?? "").trim()
        }))
        .filter((item: any) => item.original && item.optimized)
    : fallback.rewritten_bullet_points

  const changeLogRaw = payload?.change_log ?? payload?.changeLog ?? payload?.changes
  const changeLog = shouldUseFallback
    ? fallback.change_log
    : Array.isArray(changeLogRaw)
    ? changeLogRaw
        .map((item: any) => ({
          section: String(item?.section ?? "Update").trim(),
          before: String(item?.before ?? "").trim(),
          after: String(item?.after ?? "").trim(),
          reason: String(item?.reason ?? "").trim()
        }))
        .filter((item: any) => item.after)
    : fallback.change_log
  const safeChangeLog = sanitizeChangeLog(changeLog, fallback.change_log)

  const fallbackResumeData = buildResumeTemplateDataFromText(finalOptimizedResumeText)
  const resumeData = fallbackResumeData
  const latexResume = renderResumeLatex(resumeData)

  return {
    missing_keywords: missingKeywords.length ? missingKeywords : fallback.missing_keywords,
    ats_score_out_of_100: score,
    optimized_resume_text: finalOptimizedResumeText,
    optimized_resume_data: resumeData,
    keyword_injection_plan: keywordPlan,
    change_log: safeChangeLog,
    rewritten_bullet_points: rewritten,
    optimized_latex_resume: latexResume
  }
}

export async function POST(request: NextRequest) {
  try {
    const ai = getAIConfig()
    const { job_title, company, job_description, base_resume, page_count, base_latex_template } = await request.json()

    if (!job_description || !base_resume) {
      return NextResponse.json(
        { error: "job_description and base_resume are required" },
        { status: 400 }
      )
    }

    const fallback = localOptimize({ job_title, company, job_description, base_resume })

    if (!ai) {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "missing-key" }
      })
    }

    let response: Response
    try {
      response = await fetch(`${ai.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "InterviewMint Job Optimizer"
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: optimizerPrompt },
          {
            role: "user",
            content: `JOB_TITLE:\n${job_title || "Unknown"}\n\nCOMPANY:\n${company || "Unknown"}\n\nORIGINAL_PAGE_COUNT:\n${page_count || "Unknown"}\n\nBASE_RESUME:\n${base_resume}\n\nJOB_DESCRIPTION:\n${job_description}\n\nBASE_LATEX_TEMPLATE:\n${base_latex_template || DEFAULT_RESUME_LATEX_TEMPLATE}\n\nIMPORTANT:\nUpdate only summary/skills/experience bullets for ATS relevance. Preserve education/projects/certifications and overall visual structure.`
          }
        ],
        response_format: { type: "json_object" }
      })
      })
    } catch {
      return NextResponse.json(
        fallback,
        { headers: { "x-interviewmint-ai-fallback": "network" } }
      )
    }

    let completion: any = null
    try {
      completion = await response.json()
    } catch {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "invalid-provider-json" }
      })
    }

    if (!response.ok) {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "provider" }
      })
    }

    const raw = completion?.choices?.[0]?.message?.content || "{}"
    const jsonText = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/)?.[0] || raw : "{}"
    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "unparseable-model-output" }
      })
    }

    return NextResponse.json(normalizeOptimizePayload(parsed, fallback, base_resume, job_description, company))
  } catch (error) {
    return NextResponse.json({ error: `optimize_failed: ${(error as Error).message}` }, { status: 500 })
  }
}
