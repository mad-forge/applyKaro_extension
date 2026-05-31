import { NextResponse } from "next/server"

const getAIConfig = () => {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENROUTER_API_KEY
    ? "https://openrouter.ai/api/v1"
    : process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"

  return {
    apiKey,
    baseURL,
    model: process.env.AI_MODEL || "gpt-4o-mini"
  }
}

const analysisPrompt = `You are ApplyKro's career copilot.
Return strict JSON only. No markdown.
Create this exact shape:
{
  "job_profile": {
    "title": string,
    "company": string,
    "skills": string[],
    "responsibilities": string[],
    "requirements": string[],
    "experience": string,
    "technologies": string[],
    "summary": string
  },
  "candidate_profile": {
    "skills": string[],
    "projects": string[],
    "experience": string[],
    "education": string[],
    "certifications": string[],
    "achievements": string[]
  },
  "match_analysis": {
    "match_score": number,
    "skill_match": number,
    "experience_match": number,
    "keyword_match": number,
    "matched_skills": string[],
    "missing_skills": string[],
    "missing_keywords": string[],
    "weak_areas": string[],
    "explanation": string
  },
  "resume_optimization": {
    "better_summary": string[],
    "better_experience_points": string[],
    "better_project_points": string[],
    "ats_keywords_suggestions": string[]
  },
  "interview_prep": {
    "technical": [{"question": string, "why_asked": string, "evaluates": string, "talking_points": string[]}],
    "role_specific": [{"question": string, "why_asked": string, "evaluates": string, "talking_points": string[]}],
    "behavioral": [{"question": string, "why_asked": string, "evaluates": string, "talking_points": string[]}]
  },
  "career_copilot": {
    "why_not_matching": string[],
    "hiring_manager_perspective": string[],
    "improvement_priority": {"high": string[], "medium": string[], "low": string[]}
  },
  "fit_prediction": {
    "label": "Strong Fit" | "Moderate Fit" | "Weak Fit",
    "reason": string[],
    "missing": string[]
  }
}
Rules:
- Do not rewrite the whole resume.
- Keep optimization suggestions section-wise and truthful to the supplied resume.
- Technical must have exactly 3 items, role_specific exactly 2, behavioral exactly 2.`

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ")

const unique = (items: string[], limit = 20) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit)

const technologyTerms = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Java",
  "AWS",
  "Docker",
  "Kubernetes",
  "CI/CD",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "GraphQL",
  "REST",
  "Git",
  "Testing",
  "Jest",
  "Cypress",
  "Tailwind",
  "Redux",
  "Express",
  "Spring",
  "Azure",
  "GCP"
]

const extractTerms = (text: string) => {
  const lower = normalize(text)
  const explicit = technologyTerms.filter((term) => lower.includes(normalize(term).trim()))
  const capitalized =
    text.match(/\b([A-Z][A-Za-z0-9+#.]{2,}(?:\s+[A-Z][A-Za-z0-9+#.]{2,}){0,2})\b/g) || []

  return unique([...explicit, ...capitalized.filter((item) => !/^(The|This|And|For|With|Responsibilities)$/i.test(item))], 24)
}

const linesWith = (text: string, pattern: RegExp, limit = 6) =>
  unique(
    text
      .split(/\n|•|-/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 12 && pattern.test(line)),
    limit
  )

const scoreFromCoverage = (matched: number, total: number, floor = 35) => {
  if (!total) return floor
  return Math.max(floor, Math.min(98, Math.round((matched / total) * 100)))
}

const buildFallback = ({
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
  const jdTerms = extractTerms(job_description)
  const resumeTerms = extractTerms(base_resume)
  const resumeNormalized = normalize(base_resume)
  const matchedSkills = jdTerms.filter((term) => resumeNormalized.includes(normalize(term).trim()))
  const missingSkills = jdTerms.filter((term) => !matchedSkills.includes(term)).slice(0, 10)
  const skillMatch = scoreFromCoverage(matchedSkills.length, jdTerms.length)
  const experienceSignals = /\b(\d+\+?\s*years?|senior|lead|production|scale|deploy|stakeholder|ownership)\b/i
  const experienceMatch = experienceSignals.test(base_resume) ? Math.min(95, skillMatch + 8) : Math.max(30, skillMatch - 12)
  const keywordMatch = scoreFromCoverage(matchedSkills.length, jdTerms.length, 30)
  const matchScore = Math.round(skillMatch * 0.45 + experienceMatch * 0.3 + keywordMatch * 0.25)

  const responsibilities = linesWith(job_description, /\b(build|develop|design|own|lead|collaborate|implement|manage|deliver)\b/i)
  const requirements = linesWith(job_description, /\b(required|experience|proficient|knowledge|must|should|degree|years)\b/i)
  const interviewTerms = unique([...jdTerms, "the core technology", "system design", "problem solving"], 3)
  const rolePrompts = responsibilities.length
    ? responsibilities.slice(0, 2)
    : ["own a feature from requirements to delivery", "collaborate with cross-functional stakeholders"]

  return {
    job_profile: {
      title: job_title || "Target Role",
      company: company || "Target Company",
      skills: jdTerms.slice(0, 12),
      responsibilities,
      requirements,
      experience: requirements.find((line) => /\d+\+?\s*years?/i.test(line)) || "Experience requirements inferred from the JD.",
      technologies: jdTerms.filter((term) => technologyTerms.some((known) => normalize(known) === normalize(term))).slice(0, 12),
      summary: `${job_title || "This role"} focuses on ${jdTerms.slice(0, 4).join(", ") || "the listed job responsibilities"}.`
    },
    candidate_profile: {
      skills: resumeTerms.slice(0, 16),
      projects: linesWith(base_resume, /\b(project|built|created|developed|implemented)\b/i, 6),
      experience: linesWith(base_resume, /\b(experience|engineer|developer|intern|worked|led|owned)\b/i, 6),
      education: linesWith(base_resume, /\b(university|college|bachelor|master|degree|education)\b/i, 4),
      certifications: linesWith(base_resume, /\b(certification|certified|certificate)\b/i, 4),
      achievements: linesWith(base_resume, /\b(improved|increased|reduced|optimized|achieved|won|ranked|%|\d+x)\b/i, 6)
    },
    match_analysis: {
      match_score: matchScore,
      skill_match: skillMatch,
      experience_match: experienceMatch,
      keyword_match: keywordMatch,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      missing_keywords: missingSkills,
      weak_areas: missingSkills.length
        ? [`Add truthful evidence for ${missingSkills.slice(0, 3).join(", ")}.`]
        : ["Add more quantified impact to make the fit easier to verify."],
      explanation: `Score is based on ${matchedSkills.length}/${jdTerms.length || 1} important JD terms found in the resume plus experience evidence.`
    },
    resume_optimization: {
      better_summary: [
        `Mention ${jdTerms.slice(0, 3).join(", ") || "the target role keywords"} only if supported by your background.`
      ],
      better_experience_points: [
        "Add quantified outcomes to the most relevant experience bullets.",
        missingSkills[0] ? `Add a truthful bullet showing exposure to ${missingSkills[0]}.` : "Mirror the JD's strongest verbs in existing bullets."
      ],
      better_project_points: [
        missingSkills[1] ? `Add project evidence for ${missingSkills[1]} if you have it.` : "Bring the most relevant project closer to the top."
      ],
      ats_keywords_suggestions: missingSkills
    },
    interview_prep: {
      technical: interviewTerms.slice(0, 3).map((term) => ({
        question: `How have you used ${term} in a production or project setting?`,
        why_asked: `The JD signals ${term} as relevant.`,
        evaluates: `Depth of hands-on ${term} experience.`,
        talking_points: ["Project context", "Technical decision", "Result or metric"]
      })),
      role_specific: rolePrompts.slice(0, 2).map((line) => ({
        question: `Tell me about a time you handled work similar to: ${line}`,
        why_asked: "This maps directly to the role's responsibilities.",
        evaluates: "Role readiness and ownership.",
        talking_points: ["Problem", "Your action", "Business or user impact"]
      })),
      behavioral: [
        {
          question: "Tell me about a time you had to learn a missing skill quickly.",
          why_asked: "The match analysis may show gaps.",
          evaluates: "Learning speed and honesty.",
          talking_points: ["Gap", "Learning plan", "Outcome"]
        },
        {
          question: "Describe a time you worked with unclear requirements.",
          why_asked: "Most roles require collaboration under ambiguity.",
          evaluates: "Communication and ownership.",
          talking_points: ["Stakeholders", "Clarifying questions", "Delivered result"]
        }
      ]
    },
    career_copilot: {
      why_not_matching: missingSkills.slice(0, 5).map((skill) => `Missing or weak evidence for ${skill}.`),
      hiring_manager_perspective: [
        missingSkills[0]
          ? `Recruiter may notice ${missingSkills[0]} in the JD but not in the resume.`
          : "Recruiter may want clearer metrics and scope."
      ],
      improvement_priority: {
        high: missingSkills.slice(0, 2).map((skill) => `Add truthful evidence for ${skill}.`),
        medium: ["Add metrics to the most relevant project or experience bullets."],
        low: ["Tighten summary wording around the target role."]
      }
    },
    fit_prediction: {
      label: matchScore >= 78 ? "Strong Fit" : matchScore >= 55 ? "Moderate Fit" : "Weak Fit",
      reason: [`${skillMatch}% skill overlap`, `${experienceMatch}% experience signal`, `${keywordMatch}% keyword coverage`],
      missing: missingSkills.slice(0, 5)
    }
  }
}

const normalizeQuestionSet = (items: any[], count: number, fallback: any[]) => {
  const normalized = Array.isArray(items) ? items.filter(Boolean).slice(0, count) : []
  while (normalized.length < count) normalized.push(fallback[normalized.length % fallback.length])
  return normalized.slice(0, count)
}

const normalizePayload = (payload: any, fallback: ReturnType<typeof buildFallback>) => ({
  ...fallback,
  ...payload,
  interview_prep: {
    technical: normalizeQuestionSet(payload?.interview_prep?.technical, 3, fallback.interview_prep.technical),
    role_specific: normalizeQuestionSet(payload?.interview_prep?.role_specific, 2, fallback.interview_prep.role_specific),
    behavioral: normalizeQuestionSet(payload?.interview_prep?.behavioral, 2, fallback.interview_prep.behavioral)
  }
})

export async function POST(request: Request) {
  try {
    const { job_title, company, job_description, base_resume } = await request.json()

    if (!job_description || !base_resume) {
      return NextResponse.json({ error: "job_description and base_resume are required" }, { status: 400 })
    }

    const fallback = buildFallback({ job_title, company, job_description, base_resume })
    const ai = getAIConfig()

    if (!ai.apiKey) return NextResponse.json(fallback)

    const response = await fetch(`${ai.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: analysisPrompt },
          {
            role: "user",
            content: `JOB_TITLE:\n${job_title || "Unknown"}\n\nCOMPANY:\n${company || "Unknown"}\n\nJOB_DESCRIPTION:\n${job_description}\n\nBASE_RESUME:\n${base_resume}`
          }
        ]
      })
    })

    if (!response.ok) return NextResponse.json(fallback)

    const completion = await response.json()
    const raw = completion?.choices?.[0]?.message?.content || "{}"
    const parsed = JSON.parse(typeof raw === "string" ? raw : "{}")

    return NextResponse.json(normalizePayload(parsed, fallback))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Career analysis failed" }, { status: 500 })
  }
}
