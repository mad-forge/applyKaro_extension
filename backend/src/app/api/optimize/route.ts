import Handlebars from "handlebars/dist/cjs/handlebars"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import {
  RESUME_LATEX_HANDLEBARS_TEMPLATE,
  buildResumeTemplateDataFromText,
  type ResumeTemplateData
} from "@/lib/dynamic-resume-template"
import {
  optimizeModelResponseSchema,
  type OptimizeModelResponse
} from "@/lib/optimize-response-schema"

const LLM_TIMEOUT_MS = 15_000

const getAIConfig = () => {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) return null

  return {
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    model: process.env.AI_MODEL || "gpt-4o-mini"
  }
}

const optimizerPrompt = `You are InterviewMint's senior ATS resume strategist and strict JSON generator.
You will receive:
1) A JSON representing the candidate's current summary, skills, and experience bullet points
2) The original resume page count
3) A job description

Return ONLY a valid JSON object with this exact schema:
{
  "optimized_resume_data": {
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
        "points": string[]
      }
    ]
  }
}

Rules:
- Output valid parseable JSON only.
- Do not include markdown, prose, comments, or code fences.
- Make minimal, targeted ATS edits.
- Preserve truthfulness. Do not invent tools, projects, education, achievements, or years of experience.
- Keep the exact same number of experience items and points in each item as the input CANDIDATE_DATA.
- Update ONLY summary, skills, and points. Do not include title, company, location, or duration in the experience objects.
- Add only job-description keywords that are already supported by the base resume.
- Place technologies in skills, role-fit language in summary, and responsibilities in experience bullets.
- If ORIGINAL_PAGE_COUNT is 1, keep the content concise. If it is 2 or more, preserve detail.
- Return all skill arrays, even if some are empty.`

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

const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)))
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+.#]/g, "")

const sanitizeForLatex = (text: string) =>
  text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")

const sanitizeLine = (value: string) =>
  value
    .replace(/\r/g, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()

const sanitizeList = (items?: string[]) =>
  Array.isArray(items) ? uniq(items.map((item) => sanitizeLine(String(item ?? ""))).filter(Boolean)) : []

const cleanKeyword = (value: string) =>
  value
    .replace(/^[•\-*]\s*/, "")
    .replace(/\(e\.g\.[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()

const createTermMatcher = (term: string) => new RegExp(`(^|[^a-z0-9])${normalize(term)}([^a-z0-9]|$)`, "i")
const hasKeyword = (text: string, keyword: string) => createTermMatcher(keyword).test(normalize(text))

const isLikelyCompanyKeyword = (term: string, company?: string) => {
  const cleaned = cleanKeyword(term)
  if (!cleaned) return true
  if (cleaned.length < 3) return true
  if (company && normalize(cleaned) === normalize(company)) return true
  return /\b(apply|hiring|stipend|certificate|benefits?|perks?|duration|virtual|remote|month|freshers?|students?)\b/i.test(cleaned)
}

const extractJdKeywords = (jobDescription: string, company?: string) => {
  const jd = jobDescription.toLowerCase()
  const exact = importantTerms.filter((term) => jd.includes(term.toLowerCase()))

  const lines = jobDescription
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return uniq([...genericJdTerms.filter((term) => jd.includes(term.toLowerCase())), ...exact, ...lines.map(cleanKeyword)])
    .filter((keyword) => keyword.length >= 2 && !isLikelyCompanyKeyword(keyword, company))
    .slice(0, 35)
}

const computeAtsScore = (jobDescription: string, resumeText: string, company?: string) => {
  const jdKeywords = extractJdKeywords(jobDescription, company)
  if (!jdKeywords.length) return 55

  const lines = resumeText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const bulletCount = lines.filter((line) => /^[•*-]\s+/.test(line)).length
  const matches = jdKeywords.filter((keyword) => hasKeyword(resumeText, keyword)).length
  const coverage = matches / jdKeywords.length
  const bulletStrength = Math.min(1, bulletCount / 8)
  const structureBonus = /SUMMARY/i.test(resumeText) && /SKILLS/i.test(resumeText) ? 1 : 0

  return Math.max(0, Math.min(100, Math.round(38 + coverage * 48 + bulletStrength * 10 + structureBonus * 4)))
}

const resumeDataToText = (resume: ResumeTemplateData) => {
  const lines: string[] = []

  lines.push(resume.name)
  const contactLine = [resume.location, resume.phone, resume.email].filter(Boolean).join(" | ")
  if (contactLine) lines.push(contactLine)

  const linksLine = [resume.github, resume.linkedin, resume.portfolio].filter(Boolean).join(" | ")
  if (linksLine) lines.push(linksLine)

  if (resume.summary) {
    lines.push("", "SUMMARY", resume.summary)
  }

  const skillLines = [
    resume.skills.languages?.length ? `Languages: ${resume.skills.languages.join(", ")}` : "",
    resume.skills.frontend?.length ? `Frontend: ${resume.skills.frontend.join(", ")}` : "",
    resume.skills.backend_tools?.length ? `Backend & Tools: ${resume.skills.backend_tools.join(", ")}` : "",
    resume.skills.libraries?.length ? `Libraries: ${resume.skills.libraries.join(", ")}` : "",
    resume.skills.testing?.length ? `Testing: ${resume.skills.testing.join(", ")}` : "",
    resume.skills.data?.length ? `Data: ${resume.skills.data.join(", ")}` : ""
  ].filter(Boolean)
  if (skillLines.length) lines.push("", "SKILLS", ...skillLines)

  if (resume.experience.length) {
    lines.push("", "EXPERIENCE")
    for (const item of resume.experience) {
      lines.push(item.title)
      lines.push([item.company, item.location].filter(Boolean).join(", "))
      if (item.duration) lines.push(item.duration)
      item.points.forEach((point) => lines.push(`• ${point}`))
      lines.push("")
    }
  }

  if (resume.projects.length) {
    lines.push("PROJECTS")
    for (const item of resume.projects) {
      lines.push(item.title)
      if (item.stack) lines.push(item.stack)
      item.points.forEach((point) => lines.push(`• ${point}`))
      lines.push("")
    }
  }

  if (resume.certifications?.length) {
    lines.push("CERTIFICATIONS")
    resume.certifications.forEach((item) => lines.push(`• ${item}`))
    lines.push("")
  }

  if (resume.education.length) {
    lines.push("EDUCATION")
    for (const item of resume.education) {
      lines.push(item.degree)
      if (item.institution) lines.push(item.institution)
      if (item.duration) lines.push(item.duration)
      lines.push("")
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

const sanitizeResumeDataForLatex = (resume: ResumeTemplateData): ResumeTemplateData => ({
  ...resume,
  name: sanitizeForLatex(resume.name),
  phone: sanitizeForLatex(resume.phone || ""),
  email: sanitizeForLatex(resume.email || ""),
  location: sanitizeForLatex(resume.location || ""),
  github: sanitizeForLatex(resume.github || ""),
  linkedin: sanitizeForLatex(resume.linkedin || ""),
  portfolio: sanitizeForLatex(resume.portfolio || ""),
  summary: sanitizeForLatex(resume.summary || ""),
  skills: {
    languages: sanitizeList(resume.skills.languages).map(sanitizeForLatex),
    frontend: sanitizeList(resume.skills.frontend).map(sanitizeForLatex),
    backend_tools: sanitizeList(resume.skills.backend_tools).map(sanitizeForLatex),
    libraries: sanitizeList(resume.skills.libraries).map(sanitizeForLatex),
    testing: sanitizeList(resume.skills.testing).map(sanitizeForLatex),
    data: sanitizeList(resume.skills.data).map(sanitizeForLatex)
  },
  experience: resume.experience.map((item) => ({
    title: sanitizeForLatex(sanitizeLine(item.title)),
    company: sanitizeForLatex(sanitizeLine(item.company)),
    location: sanitizeForLatex(sanitizeLine(item.location || "")),
    duration: sanitizeForLatex(sanitizeLine(item.duration || "")),
    points: sanitizeList(item.points).map(sanitizeForLatex)
  })),
  projects: resume.projects.map((item) => ({
    title: sanitizeForLatex(sanitizeLine(item.title)),
    stack: sanitizeForLatex(sanitizeLine(item.stack || "")),
    points: sanitizeList(item.points).map(sanitizeForLatex)
  })),
  certifications: sanitizeList(resume.certifications).map(sanitizeForLatex),
  education: resume.education.map((item) => ({
    degree: sanitizeForLatex(sanitizeLine(item.degree)),
    institution: sanitizeForLatex(sanitizeLine(item.institution)),
    duration: sanitizeForLatex(sanitizeLine(item.duration || ""))
  }))
})

const ensureHref = (value: string) => {
  if (!value) return ""
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

const renderSanitizedResumeLatex = (resume: ResumeTemplateData) => {
  const sanitized = sanitizeResumeDataForLatex(resume)
  const templateEngine = Handlebars.create()

  templateEngine.registerHelper("latex", (value = "") => String(value ?? ""))
  templateEngine.registerHelper("joinLatex", (items: unknown[]) =>
    Array.isArray(items) ? items.map((item) => String(item ?? "")).filter(Boolean).join(", ") : ""
  )
  templateEngine.registerHelper("href", (value: string) => ensureHref(String(value ?? "")))
  templateEngine.registerHelper("mailto", (value: string) => `mailto:${String(value ?? "")}`)

  return templateEngine.compile(RESUME_LATEX_HANDLEBARS_TEMPLATE, { noEscape: true })(sanitized)
}

const mergeOptimizedResumeData = (
  baseResumeData: ResumeTemplateData,
  optimized: OptimizeModelResponse["optimized_resume_data"]
): ResumeTemplateData => ({
  ...baseResumeData,
  summary: sanitizeLine(optimized.summary) || baseResumeData.summary,
  skills: {
    languages: sanitizeList(optimized.skills.languages),
    frontend: sanitizeList(optimized.skills.frontend),
    backend_tools: sanitizeList(optimized.skills.backend_tools),
    libraries: sanitizeList(optimized.skills.libraries),
    testing: sanitizeList(optimized.skills.testing),
    data: sanitizeList(optimized.skills.data)
  },
  experience: optimized.experience
    .map((item, index) => ({
      title: sanitizeLine(item.title || "") || baseResumeData.experience[index]?.title || "",
      company: sanitizeLine(item.company || "") || baseResumeData.experience[index]?.company || "",
      location: sanitizeLine(item.location || "") || baseResumeData.experience[index]?.location || "",
      duration: sanitizeLine(item.duration || "") || baseResumeData.experience[index]?.duration || "",
      points: sanitizeList(item.points)
    }))
    .filter((item) => item.title || item.company || item.points.length)
})

const buildKeywordInjectionPlan = (base: ResumeTemplateData, optimized: ResumeTemplateData, jobDescription: string, company?: string) => {
  const jdKeywords = extractJdKeywords(jobDescription, company)
  const beforeText = resumeDataToText(base)
  const afterText = resumeDataToText(optimized)
  const addedKeywords = jdKeywords.filter((keyword) => !hasKeyword(beforeText, keyword) && hasKeyword(afterText, keyword))

  return [
    addedKeywords.length
      ? `Added supported keywords across summary, skills, and experience: ${addedKeywords.slice(0, 10).join(", ")}`
      : "No additional safe keywords were inserted beyond the supported baseline.",
    "Projects, certifications, education, and contact details were preserved from the parsed base resume."
  ]
}

const buildChangeLog = (base: ResumeTemplateData, optimized: ResumeTemplateData) => {
  const changes: Array<{ section: string; before: string; after: string; reason: string }> = []

  if (sanitizeLine(base.summary) !== sanitizeLine(optimized.summary)) {
    changes.push({
      section: "SUMMARY",
      before: base.summary,
      after: optimized.summary,
      reason: "Updated summary for stronger ATS alignment."
    })
  }

  const skillSections: Array<keyof ResumeTemplateData["skills"]> = [
    "languages",
    "frontend",
    "backend_tools",
    "libraries",
    "testing",
    "data"
  ]
  for (const key of skillSections) {
    const before = (base.skills[key] || []).join(", ")
    const after = (optimized.skills[key] || []).join(", ")
    if (before !== after) {
      changes.push({
        section: `SKILLS:${key}`,
        before,
        after,
        reason: "Reordered or refined skills to match job-relevant keywords."
      })
    }
  }

  const beforeBullets = base.experience.flatMap((item) => item.points)
  const afterBullets = optimized.experience.flatMap((item) => item.points)
  const limit = Math.min(beforeBullets.length, afterBullets.length, 8)
  for (let index = 0; index < limit; index += 1) {
    if (beforeBullets[index] !== afterBullets[index]) {
      changes.push({
        section: "EXPERIENCE",
        before: beforeBullets[index],
        after: afterBullets[index],
        reason: "Adjusted an experience bullet to reflect relevant JD language while preserving truth."
      })
    }
  }

  return changes
}

const buildRewrittenBullets = (base: ResumeTemplateData, optimized: ResumeTemplateData) => {
  const beforeBullets = base.experience.flatMap((item) => item.points)
  const afterBullets = optimized.experience.flatMap((item) => item.points)
  const output: Array<{ original: string; optimized: string }> = []

  const limit = Math.min(beforeBullets.length, afterBullets.length, 8)
  for (let index = 0; index < limit; index += 1) {
    if (!afterBullets[index]) continue
    output.push({
      original: beforeBullets[index] || afterBullets[index],
      optimized: afterBullets[index]
    })
  }

  return output
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
  const baseResumeData = buildResumeTemplateDataFromText(base_resume)
  const jdTerms = extractJdKeywords(job_description, company)
  const optimizedResumeText = resumeDataToText(baseResumeData)

  return {
    missing_keywords: jdTerms.filter((term) => !hasKeyword(optimizedResumeText, term)).slice(0, 20),
    ats_score_out_of_100: Math.min(95, Math.max(30, computeAtsScore(job_description, optimizedResumeText, company))),
    optimized_resume_text: optimizedResumeText,
    optimized_resume_data: baseResumeData,
    keyword_injection_plan: [
      `Returned parsed base resume for ${job_title || "target role"} because AI optimization was unavailable.`,
      "Projects, certifications, education, and contact details were preserved from the parsed base resume."
    ],
    change_log: [] as Array<{ section: string; before: string; after: string; reason: string }>,
    rewritten_bullet_points: buildRewrittenBullets(baseResumeData, baseResumeData),
    optimized_latex_resume: renderSanitizedResumeLatex(baseResumeData)
  }
}

const parseProviderContent = async (response: Response) => {
  const completion = await response.json()
  const raw = completion?.choices?.[0]?.message?.content

  if (typeof raw === "string") {
    return JSON.parse(raw)
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw
  }

  throw new Error("invalid-model-content")
}

export async function POST(request: NextRequest) {
  try {
    const ai = getAIConfig()
    const { job_title, company, job_description, base_resume, page_count } = await request.json()

    if (!job_description || !base_resume) {
      return NextResponse.json({ error: "job_description and base_resume are required" }, { status: 400 })
    }

    const baseResumeData = buildResumeTemplateDataFromText(base_resume)
    const payloadToOptimize = {
      summary: baseResumeData.summary,
      skills: baseResumeData.skills,
      experience: baseResumeData.experience.map((e) => ({
        points: e.points
      }))
    }

    const fallback = localOptimize({ job_title, company, job_description, base_resume })

    if (!ai) {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "missing-key" }
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

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
              content: `JOB_TITLE:\n${job_title || "Unknown"}\n\nCOMPANY:\n${company || "Unknown"}\n\nORIGINAL_PAGE_COUNT:\n${page_count || "Unknown"}\n\nCANDIDATE_DATA:\n${JSON.stringify(payloadToOptimize)}\n\nJOB_DESCRIPTION:\n${job_description}`
            }
          ],
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      })
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(fallback, {
          headers: { "x-interviewmint-ai-fallback": "timeout" }
        })
      }

      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "network" }
      })
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "provider" }
      })
    }

    let parsedPayload: unknown
    try {
      parsedPayload = await parseProviderContent(response)
    } catch {
      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "invalid-provider-json" }
      })
    }

    let validated: OptimizeModelResponse
    try {
      validated = optimizeModelResponseSchema.parse(parsedPayload)
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(fallback, {
          headers: { "x-interviewmint-ai-fallback": "schema-validation" }
        })
      }

      return NextResponse.json(fallback, {
        headers: { "x-interviewmint-ai-fallback": "unparseable-model-output" }
      })
    }

    const optimizedResumeData = mergeOptimizedResumeData(baseResumeData, validated.optimized_resume_data)
    const optimizedResumeText = resumeDataToText(optimizedResumeData)
    const missingKeywords = extractJdKeywords(job_description, company)
      .filter((term) => !hasKeyword(optimizedResumeText, term))
      .slice(0, 20)

    return NextResponse.json({
      missing_keywords: missingKeywords,
      ats_score_out_of_100: computeAtsScore(job_description, optimizedResumeText, company),
      optimized_resume_text: optimizedResumeText,
      optimized_resume_data: optimizedResumeData,
      keyword_injection_plan: buildKeywordInjectionPlan(baseResumeData, optimizedResumeData, job_description, company),
      change_log: buildChangeLog(baseResumeData, optimizedResumeData),
      rewritten_bullet_points: buildRewrittenBullets(baseResumeData, optimizedResumeData),
      optimized_latex_resume: renderSanitizedResumeLatex(optimizedResumeData)
    })
  } catch (error) {
    return NextResponse.json({ error: `optimize_failed: ${(error as Error).message}` }, { status: 500 })
  }
}
