import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_RESUME_LATEX_TEMPLATE } from "@/lib/default-resume-template"

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
- Prioritize keywords that ATS systems often rank highly: exact technology names, role title terms, responsibilities, standards, workflows, and domain phrases from the job post.
- Reorder or tighten skills so the most job-relevant skills appear early.
- Make experience bullets sharper and closer to the job description while preserving truth.
- Do not add fake tools, fake projects, fake education, fake companies, fake achievements, or fake years of experience.
- Do not edit school, college, education, certification, or project sections except for tiny formatting cleanup.
- Optimize for keyword coverage, role relevance, action verbs, measurable outcomes, and recruiter readability.
- missing_keywords: 8-25 concrete keywords from the job description absent or weak in the resume.
- ats_score_out_of_100: integer from 0 to 100 after optimization. Be realistic.
- optimized_resume_text: the user's resume with only the targeted ATS edits applied.
- keyword_injection_plan: concise notes explaining which keywords were added and where.
- change_log: every meaningful change you made, with before/after and why.
- rewritten_bullet_points: 5-10 optimized bullets with quantified impact where possible.
- Keep every claim truthful and aligned to the original resume. Do not invent employers, degrees, certifications, years of experience, or tools not supported by the base resume.
- If a keyword is important but not supported by the resume, mention it in missing_keywords instead of fabricating it.
- Do not include markdown, prose, or code fences.
- Output valid parseable JSON only.`

const importantTerms = [
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

const cleanKeyword = (value: string) =>
  value
    .replace(/^[•\-*]\s*/, "")
    .replace(/\(e\.g\.[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()

const extractJdKeywords = (jobDescription: string) => {
  const jd = jobDescription.toLowerCase()
  const exact = importantTerms.filter((term) => jd.includes(term.toLowerCase()))

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

  return uniq([...priorityHits, ...exact, ...mustHaveBlock, ...normalizedPhraseMatches]).slice(0, 35)
}

const sectionOrder = ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "CERTIFICATIONS", "EDUCATION"]

const splitResumeIntoSections = (text: string) => {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const sections: Record<string, string[]> = {}
  let current = "SUMMARY"
  sections[current] = []

  for (const line of lines) {
    const upper = line.toUpperCase()
    if (sectionOrder.includes(upper)) {
      current = upper
      if (!sections[current]) sections[current] = []
      continue
    }
    if (!sections[current]) sections[current] = []
    sections[current].push(line)
  }

  return sections
}

const toLatexItems = (lines: string[]) => {
  if (!lines.length) return ""
  const bullets = lines.filter((line) => /^[•*-]\s*/.test(line))
  if (!bullets.length) return lines.map((line) => latexEscape(line)).join(" \\\\\n")

  const normalizedBullets = bullets.map((line) => line.replace(/^[•*-]\s*/, "").trim()).filter(Boolean)
  return `\\begin{itemize}
${normalizedBullets.map((line) => `    \\item ${latexEscape(line)}`).join("\n")}
\\end{itemize}`
}

const buildStrictLatexFromResume = (resumeText: string) => {
  const sections = splitResumeIntoSections(resumeText)
  const summary = (sections.SUMMARY || []).map((line) => latexEscape(line)).join(" ")
  const skillsRaw = sections.SKILLS || []
  const skillsLines = skillsRaw.length
    ? skillsRaw.map((line) => `\\textbf{Detail:} ${latexEscape(line)} \\\\`).join("\n")
    : "\\textbf{Detail:} \\textit{Update from base resume.}"

  const experience = toLatexItems(sections.EXPERIENCE || [])
  const projects = toLatexItems(sections.PROJECTS || [])
  const certs = toLatexItems(sections.CERTIFICATIONS || [])
  const education = (sections.EDUCATION || []).map((line) => latexEscape(line)).join(" \\\\\n")

  return DEFAULT_RESUME_LATEX_TEMPLATE
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
  const jdTerms = extractJdKeywords(job_description)
  const resumeTokens = new Set(
    resumeLower
      .split(/[\s,;/|()]+/)
      .map((t) => normalize(t))
      .filter(Boolean)
  )
  const supported = jdTerms.filter((term) => {
    const n = normalize(term)
    return n && (resumeLower.includes(term.toLowerCase()) || resumeTokens.has(n))
  })
  const missing = jdTerms.filter((term) => !supported.includes(term))
  const score = Math.min(
    92,
    Math.max(62, Math.round((supported.length / Math.max(jdTerms.length, 1)) * 45 + 48))
  )

  const lines = base_resume.replace(/\r/g, "").split("\n").map((line) => line.replace(/\s+$/g, ""))
  const summaryIndex = lines.findIndex((line) => line.trim().toUpperCase() === "SUMMARY")
  const skillsIndex = lines.findIndex((line) => line.trim().toUpperCase() === "SKILLS")
  const safeSupported = uniq(supported).slice(0, 12)
  const rolePhrase = `${job_title || "target role"}${company ? ` at ${company}` : ""}`
  const changeLog: Array<{ section: string; before: string; after: string; reason: string }> = []

  if (summaryIndex >= 0 && safeSupported.length) {
    const nextContentIndex = lines.findIndex((line, index) => index > summaryIndex && line.trim())
    if (nextContentIndex > summaryIndex) {
      const before = lines[nextContentIndex]
      const additions = safeSupported.slice(0, 4).join(", ")
      const after = `${before.replace(/\.$/, "")}. Target role alignment: ${rolePhrase}; strengths in ${additions}.`
      lines[nextContentIndex] = after
      changeLog.push({
        section: "SUMMARY",
        before,
        after,
        reason: "Added supported job-specific keywords to improve ATS match without changing role history."
      })
    }
  }

  if (skillsIndex >= 0 && safeSupported.length) {
    const insertion = `Role-fit keywords: ${safeSupported.join(", ")}`
    const alreadyHasTargeted = lines.some((line) => line.startsWith("Targeted ATS Keywords:"))
    const alreadyHasRoleFit = lines.some((line) => line.startsWith("Role-fit keywords:"))
    if (!alreadyHasTargeted && !alreadyHasRoleFit) {
      lines.splice(skillsIndex + 1, 0, insertion)
      changeLog.push({
        section: "SKILLS",
        before: "No targeted ATS keyword line",
        after: insertion,
        reason: "Placed supported job keywords near the top of Skills for parser visibility."
      })
    }
  }

  const bullets = collectResumeBullets(lines)
  const rewritten = bullets.slice(0, 8).map((bullet) => ({
    original: bullet,
    optimized: improveBullet(bullet, safeSupported)
  }))

  return {
    missing_keywords: uniq(missing).slice(0, 20),
    ats_score_out_of_100: score,
    optimized_resume_text: lines.join("\n"),
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
    optimized_latex_resume: DEFAULT_RESUME_LATEX_TEMPLATE
  }
}

const normalizeOptimizePayload = (
  payload: any,
  fallback: ReturnType<typeof localOptimize>,
  originalResume: string
) => {
  const scoreRaw =
    payload?.ats_score_out_of_100 ??
    payload?.ats_score ??
    payload?.score ??
    payload?.atsScoreOutOf100
  const score = Number.isFinite(Number(scoreRaw)) ? Math.max(0, Math.min(100, Number(scoreRaw))) : fallback.ats_score_out_of_100

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

  const keywordPlanRaw = payload?.keyword_injection_plan ?? payload?.keywordPlan ?? payload?.injection_plan
  const keywordPlan = Array.isArray(keywordPlanRaw)
    ? keywordPlanRaw.map((item) => String(item).trim()).filter(Boolean)
    : fallback.keyword_injection_plan

  const rewrittenRaw = payload?.rewritten_bullet_points ?? payload?.rewrittenBullets ?? payload?.bullet_rewrites
  const rewritten = Array.isArray(rewrittenRaw)
    ? rewrittenRaw
        .map((item: any) => ({
          original: String(item?.original ?? "").trim(),
          optimized: String(item?.optimized ?? "").trim()
        }))
        .filter((item: any) => item.original && item.optimized)
    : fallback.rewritten_bullet_points

  const changeLogRaw = payload?.change_log ?? payload?.changeLog ?? payload?.changes
  const changeLog = Array.isArray(changeLogRaw)
    ? changeLogRaw
        .map((item: any) => ({
          section: String(item?.section ?? "Update").trim(),
          before: String(item?.before ?? "").trim(),
          after: String(item?.after ?? "").trim(),
          reason: String(item?.reason ?? "").trim()
        }))
        .filter((item: any) => item.after)
    : fallback.change_log

  const latexResume = buildStrictLatexFromResume(
    typeof payload?.optimized_resume_text === "string" && payload.optimized_resume_text.trim()
      ? payload.optimized_resume_text
      : originalResume
  )

  return {
    missing_keywords: missingKeywords.length ? missingKeywords : fallback.missing_keywords,
    ats_score_out_of_100: score,
    optimized_resume_text: optimizedResumeText,
    keyword_injection_plan: keywordPlan,
    change_log: changeLog,
    rewritten_bullet_points: rewritten,
    optimized_latex_resume: latexResume
  }
}

export async function POST(request: NextRequest) {
  try {
    const ai = getAIConfig()
    const { job_title, company, job_description, base_resume, page_count, base_latex_template } = await request.json()
    const fallback = localOptimize({ job_title, company, job_description, base_resume })

    if (!job_description || !base_resume) {
      return NextResponse.json(
        { error: "job_description and base_resume are required" },
        { status: 400 }
      )
    }

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

    return NextResponse.json(normalizeOptimizePayload(parsed, fallback, base_resume))
  } catch (error) {
    return NextResponse.json({ error: `optimize_failed: ${(error as Error).message}` }, { status: 500 })
  }
}
