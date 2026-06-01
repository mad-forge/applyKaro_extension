import Handlebars from "handlebars/dist/cjs/handlebars"

export type ResumeTemplateData = {
  name: string
  phone?: string
  email?: string
  location?: string
  github?: string
  linkedin?: string
  portfolio?: string
  summary: string
  skills: {
    languages?: string[]
    frontend?: string[]
    backend_tools?: string[]
    libraries?: string[]
    testing?: string[]
    data?: string[]
  }
  experience: Array<{
    title: string
    company: string
    location?: string
    duration?: string
    points: string[]
  }>
  projects: Array<{
    title: string
    stack?: string
    points: string[]
  }>
  certifications?: string[]
  education: Array<{
    degree: string
    institution: string
    duration?: string
  }>
}

export const RESUME_JSON_SCHEMA_EXAMPLE: ResumeTemplateData = {
  name: "Krishnakant Jha",
  phone: "8678815807",
  email: "jhakrishnakant558@gmail.com",
  location: "Supaul, Bihar",
  github: "",
  linkedin: "",
  portfolio: "",
  summary:
    "Detail-oriented QA Engineer with 4+ years of experience in manual and automation testing using Cypress, with additional frontend development experience in React.js, JavaScript, HTML, and CSS.",
  skills: {
    languages: ["JavaScript", "HTML5", "CSS3"],
    frontend: ["React.js", "Responsive UI", "Accessibility"],
    backend_tools: ["REST APIs", "Postman", "Git", "GitHub", "Jira"],
    libraries: ["Cypress", "BDD Cucumber"],
    testing: ["Manual Testing", "Automation Testing", "Regression Testing", "API Testing"],
    data: []
  },
  experience: [
    {
      title: "QA Analyst | Frontend Developer (React JS)",
      company: "Codebucket Solutions Private Limited",
      location: "",
      duration: "Oct 2022 -- Present",
      points: [
        "Developed and maintained Cypress automation scripts for web applications, improving regression coverage.",
        "Performed manual test execution for functional, regression, API, and UI testing.",
        "Collaborated with developers and product owners in Agile sprints to review requirements and identify test scenarios."
      ]
    }
  ],
  projects: [
    {
      title: "Bipard Chat Application Admin Panel",
      stack: "React.js, REST APIs, RBAC",
      points: [
        "Built a scalable admin panel from scratch using React.js.",
        "Implemented role-based access control for secure user permissions."
      ]
    }
  ],
  certifications: [],
  education: [
    {
      degree: "MCA",
      institution: "B.S College Danapur, Patna, Patliputra University",
      duration: "2023 -- 2025"
    }
  ]
}

export const RESUME_RENDER_CODE_EXAMPLE = String.raw`import Handlebars from "handlebars"
import { RESUME_LATEX_HANDLEBARS_TEMPLATE } from "./dynamic-resume-template"

Handlebars.registerHelper("latex", (value = "") => {
  return String(value)
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
})

const render = Handlebars.compile(RESUME_LATEX_HANDLEBARS_TEMPLATE)
const latex = render(payload)
`

export const RESUME_LATEX_HANDLEBARS_TEMPLATE = String.raw`\documentclass[a4paper,10pt]{article}

\usepackage[T1]{fontenc}
\usepackage{times}
\usepackage{latexsym}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\usepackage{geometry}

\geometry{top=0.3in, bottom=0.3in, left=0.4in, right=0.4in}

\titleformat{\section}{
  \vspace{-5pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\titlerule \vspace{-5pt}]

\setlist[itemize]{leftmargin=0.15in, itemsep=0pt, parsep=0pt, topsep=1pt, partopsep=0pt}

\begin{document}
\pagestyle{empty}

\begin{center}
    {\Huge \textbf{ {{latex name}} }} \\ \vspace{2pt}
    \small {{#if location}}{{latex location}}{{/if}}{{#if phone}}{{#if location}} $|$ {{/if}}Phone: {{latex phone}}{{/if}}{{#if email}}{{#if phone}} $|$ {{else}}{{#if location}} $|$ {{/if}}{{/if}}Email: \href{ {{mailto email}} }{\underline{ {{latex email}} }}{{/if}} \\ \vspace{2pt}
    {{#if github}}GitHub: \href{ {{href github}} }{\underline{ {{latex github}} }}{{/if}}{{#if linkedin}}{{#if github}} $|$ {{/if}}LinkedIn: \href{ {{href linkedin}} }{\underline{ {{latex linkedin}} }}{{/if}}{{#if portfolio}}{{#if linkedin}} $|$ {{else}}{{#if github}} $|$ {{/if}}{{/if}}Portfolio: \href{ {{href portfolio}} }{\underline{ {{latex portfolio}} }}{{/if}}
\end{center}
\vspace{-6pt}

{{#if summary}}
\section{Summary}
{{latex summary}}
{{/if}}

\section{Skills}
\noindent
{{#if skills.languages}}\textbf{Languages:} {{joinLatex skills.languages}} \\{{/if}}
{{#if skills.frontend}}\textbf{Frontend:} {{joinLatex skills.frontend}} \\{{/if}}
{{#if skills.backend_tools}}\textbf{Backend \& Tools:} {{joinLatex skills.backend_tools}} \\{{/if}}
{{#if skills.libraries}}\textbf{Libraries/Frameworks:} {{joinLatex skills.libraries}} \\{{/if}}
{{#if skills.testing}}\textbf{Testing:} {{joinLatex skills.testing}} \\{{/if}}
{{#if skills.data}}\textbf{Data:} {{joinLatex skills.data}} \\{{/if}}

{{#if experience}}
\section{Experience}
{{#each experience}}
\noindent
\textbf{ {{latex title}} } {{#if duration}}\hfill {{latex duration}}{{/if}} \\
\textit{ {{latex company}}{{#if location}}, {{latex location}}{{/if}} }
\begin{itemize}
{{#each points}}
    \item {{latex this}}
{{/each}}
\end{itemize}
\vspace{2pt}
{{/each}}
{{/if}}

{{#if projects}}
\section{Projects}
{{#each projects}}
\noindent
\textbf{ {{latex title}} } \\
{{#if stack}}\textit{ {{latex stack}} }{{/if}}
\begin{itemize}
{{#each points}}
    \item {{latex this}}
{{/each}}
\end{itemize}
{{/each}}
{{/if}}

{{#if certifications}}
\section{Certifications}
\begin{itemize}
{{#each certifications}}
    \item {{latex this}}
{{/each}}
\end{itemize}
{{/if}}

{{#if education}}
\section{Education}
{{#each education}}
\noindent
\textbf{ {{latex degree}} } {{#if duration}}\hfill {{latex duration}}{{/if}} \\
\textit{ {{latex institution}} }
\vspace{2pt}
{{/each}}
{{/if}}

\end{document}
`

const latexEscape = (value: unknown) =>
  String(value ?? "")
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

const toHref = (value: string) => {
  if (!value) return ""
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return latexEscape(url)
}

let helpersRegistered = false

const registerHelpers = () => {
  if (helpersRegistered) return

  Handlebars.registerHelper("latex", latexEscape)
  Handlebars.registerHelper("joinLatex", (items: unknown[]) =>
    Array.isArray(items) ? items.map(latexEscape).filter(Boolean).join(", ") : ""
  )
  Handlebars.registerHelper("href", (value: string) => toHref(value))
  Handlebars.registerHelper("mailto", (value: string) => `mailto:${latexEscape(value)}`)
  helpersRegistered = true
}

const cleanLine = (line: string) =>
  line
    .replace(/\r/g, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()

const unique = (items: string[], limit = 20) =>
  Array.from(new Set(items.map(cleanLine).filter(Boolean))).slice(0, limit)

const isHeading = (line: string) =>
  /^(summary|objective|skills|technical skills|professional experience|experience|work experience|projects|web development projects|latest projects|certifications|education|personal details|languages)$/i.test(
    cleanLine(line)
  )

const isContactLine = (line: string) =>
  /@|\+?\d[\d\s().-]{7,}\d/.test(cleanLine(line))

const isDateOnlyLine = (line: string) =>
  /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}\s*-\s*\d{2,4}|\d{4})$/i.test(cleanLine(line))

const findName = (lines: string[]) =>
  lines.find((line) => {
    const cleaned = cleanLine(line)
    return (
      /^[A-Z][A-Z\s.'-]{3,45}$/.test(cleaned) &&
      cleaned.split(/\s+/).length >= 2 &&
      !isHeading(cleaned) &&
      !/^till now$/i.test(cleaned) &&
      !isDateOnlyLine(cleaned) &&
      !isContactLine(cleaned)
    )
  }) ||
  lines.find((line) => {
    const cleaned = cleanLine(line)
    return (
      /^[A-Za-z][A-Za-z\s.'-]{3,45}$/.test(cleaned) &&
      cleaned.split(/\s+/).length >= 2 &&
      !isHeading(cleaned) &&
      !/^till now$/i.test(cleaned) &&
      !isDateOnlyLine(cleaned) &&
      !isContactLine(cleaned)
    )
  }) ||
  "Your Name"

const parseSkills = (lines: string[]) => {
  const all = lines.join(" ")
  const has = (pattern: RegExp) => pattern.test(all)
  return {
    languages: unique([
      has(/javascript/i) ? "JavaScript" : "",
      has(/typescript/i) ? "TypeScript" : "",
      has(/\bhtml/i) ? "HTML5" : "",
      has(/\bcss/i) ? "CSS3" : "",
      has(/\bsql\b/i) ? "SQL" : ""
    ]),
    frontend: unique([
      has(/react/i) ? "React.js" : "",
      has(/responsive/i) ? "Responsive Design" : "",
      has(/accessibility/i) ? "Accessibility" : "",
      has(/tailwind/i) ? "Tailwind CSS" : ""
    ]),
    backend_tools: unique([
      has(/rest api|apis?/i) ? "REST APIs" : "",
      has(/postman/i) ? "Postman" : "",
      has(/\bgit\b/i) ? "Git" : "",
      has(/github/i) ? "GitHub" : "",
      has(/jira/i) ? "Jira" : "",
      has(/node/i) ? "Node.js" : ""
    ]),
    libraries: unique([
      has(/cypress/i) ? "Cypress" : "",
      has(/cucumber/i) ? "BDD Cucumber" : "",
      has(/redux/i) ? "Redux" : "",
      has(/mui/i) ? "MUI" : ""
    ]),
    testing: unique([
      has(/manual/i) ? "Manual Testing" : "",
      has(/automation/i) ? "Automation Testing" : "",
      has(/regression/i) ? "Regression Testing" : "",
      has(/api testing/i) ? "API Testing" : "",
      has(/ui testing/i) ? "UI Testing" : ""
    ]),
    data: unique([has(/inventory|erp/i) ? "Inventory Management" : ""])
  }
}

const bulletize = (lines: string[], limit = 5) =>
  unique(
    lines
      .map((line) => cleanLine(line).replace(/^[•*-]\s*/, ""))
      .filter((line) => line.length > 18 && !isHeading(line)),
    limit
  )

const normalizeHeadingKey = (line: string) => {
  const cleaned = cleanLine(line).toUpperCase()
  if (/^(SUMMARY|OBJECTIVE)$/.test(cleaned)) return "SUMMARY"
  if (/^(SKILLS|TECHNICAL SKILLS)$/.test(cleaned)) return "SKILLS"
  if (/^(EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE)$/.test(cleaned)) return "EXPERIENCE"
  if (/^(PROJECTS|WEB DEVELOPMENT PROJECTS|LATEST PROJECTS)$/.test(cleaned)) return "PROJECTS"
  if (/^CERTIFICATIONS?$/.test(cleaned)) return "CERTIFICATIONS"
  if (/^EDUCATION$/.test(cleaned)) return "EDUCATION"
  if (/^(PERSONAL DETAILS|LANGUAGES)$/.test(cleaned)) return "PERSONAL"
  return ""
}

const splitIntoSections = (lines: string[]) => {
  const sections: Record<string, string[]> = {
    HEADER: [],
    SUMMARY: [],
    SKILLS: [],
    EXPERIENCE: [],
    PROJECTS: [],
    CERTIFICATIONS: [],
    EDUCATION: [],
    PERSONAL: []
  }
  let active: keyof typeof sections = "HEADER"
  for (const line of lines) {
    const key = normalizeHeadingKey(line)
    if (key) {
      active = key as keyof typeof sections
      continue
    }
    sections[active].push(line)
  }
  return sections
}

const isProjectLikeLine = (line: string) =>
  /\b(admin panel|erp|application|dham|project)\b/i.test(line)

const isEducationLikeLine = (line: string) =>
  /\b(matric|inter|bca|mca|college|school|university)\b/i.test(line)

const isDurationLine = (line: string) =>
  /\b(20\d{2}|19\d{2}|present|till now)\b/i.test(line) && /-|to|till/i.test(line)

const isRoleLine = (line: string) =>
  /\b(QA Analyst|Software Engineer|Frontend Developer|Front End Developer|Developer|Engineer)\b/i.test(cleanLine(line))

const isEducationDegree = (line: string) =>
  /^(MATRIC|INTER|BCA|MCA|B\.?TECH|BACHELOR|MASTER|12TH|10TH)\b/i.test(cleanLine(line))

const isPersonalDetailLine = (line: string) =>
  /^(Date of Birth|Marital Status|Nationality|ENGLISH|HINDI|PERSONAL DETAILS|LANGUAGES)$/i.test(cleanLine(line)) ||
  /^:/.test(cleanLine(line))

const parseEducation = (lines: string[]): ResumeTemplateData["education"] => {
  const cleaned = lines.map(cleanLine).filter(Boolean).filter((line) => !isPersonalDetailLine(line))
  const entries: ResumeTemplateData["education"] = []
  const seen = new Set<string>()

  for (let index = 0; index < cleaned.length; index += 1) {
    const degree = cleaned[index]
    if (!isEducationDegree(degree)) continue

    const institution = cleaned
      .slice(index + 1)
      .find((line) => !isEducationDegree(line) && !isPersonalDetailLine(line)) || ""
    const key = `${degree.toLowerCase()}|${institution.toLowerCase()}`
    if (seen.has(key)) continue

    seen.add(key)
    entries.push({ degree, institution, duration: "" })
  }

  return entries
}

export const buildResumeTemplateDataFromText = (resumeText: string): ResumeTemplateData => {
  const lines = resumeText.replace(/\r/g, "").split("\n").map(cleanLine).filter(Boolean)
  const sections = splitIntoSections(lines)
  const headerLines = sections.HEADER.length ? sections.HEADER : lines.slice(0, 12)
  const name = findName(lines.slice(0, 12))
  const email = lines.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
  const phone = lines.join(" ").match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || ""
  const location =
    lines.find((line) => /bihar|patna|supaul|delhi|india/i.test(line) && !/@|\d[\d\s().-]{7,}/.test(line)) || ""

  const firstSkillIndex = lines.findIndex((line) =>
    /^(Test .*Tools|Test Framework|Development Environment|Programming language|API Testing Tool|Version Control|Bug Tracking Tool|Mobile Testing|Methodologies|Test Management Tool|Operating System|Major Skills|Additional Skills|Skills:)/i.test(line)
  )
  const roleIndex = lines.findIndex((line, index) => isRoleLine(line) && index > Math.max(firstSkillIndex, 0))
  const firstEducationIndex = lines.findIndex((line) => /^EDUCATION$/i.test(line) || isEducationDegree(line))
  const experienceEndIndex = firstEducationIndex >= 0 ? firstEducationIndex : lines.length
  const inferredExperienceLines =
    roleIndex >= 0 ? lines.slice(roleIndex, experienceEndIndex) : sections.EXPERIENCE

  const summarySource = sections.SUMMARY.length
    ? sections.SUMMARY
    : lines.slice(0, firstSkillIndex >= 0 ? firstSkillIndex : roleIndex >= 0 ? roleIndex : Math.min(lines.length, 8))
  const summary =
    bulletize(
      summarySource.filter(
        (line) =>
          line !== name &&
          !/^till now$/i.test(line) &&
          !isDateOnlyLine(line) &&
          !isContactLine(line) &&
          line !== location
      ),
      3
    ).join(" ") ||
    bulletize(
      lines.filter((line) => /detail-oriented|engineer|developer|testing|react/i.test(line) && !/till now/i.test(line)),
      2
    ).join(" ")

  const inferredSkillLines =
    firstSkillIndex >= 0 && roleIndex > firstSkillIndex ? lines.slice(firstSkillIndex, roleIndex) : []
  const skillLines = sections.SKILLS.length
    ? sections.SKILLS
    : inferredSkillLines.length
    ? inferredSkillLines
    : lines.filter((line) =>
        /tool|framework|environment|language|testing|git|jira|postman|react|css|html|javascript|cypress/i.test(line)
      )
  const experienceLines = sections.EXPERIENCE.length ? sections.EXPERIENCE : inferredExperienceLines
  const projectLines = [...sections.PROJECTS, ...experienceLines.filter(isProjectLikeLine)]
  const educationLines = lines.filter((line) => isEducationLikeLine(line) || isPersonalDetailLine(line))

  const experienceTitle = experienceLines.find((line) => /analyst|developer|engineer/i.test(line)) || ""
  const companyLine = experienceLines.find((line) => /solutions|limited|pvt|private|technologies|labs/i.test(line)) || ""
  const topDuration =
    isDateOnlyLine(lines[0] || "") && /^-?\s*till now$/i.test(lines[1] || "")
      ? `${lines[0]} - Till Now`
      : ""
  const durationLine = experienceLines.find((line) => isDurationLine(line) && /20\d{2}/.test(line)) || topDuration

  return {
    name,
    phone,
    email,
    location,
    github: headerLines.find((line) => /github\.com/i.test(line)) || "",
    linkedin: headerLines.find((line) => /linkedin\.com/i.test(line)) || "",
    portfolio: headerLines.find((line) => /(portfolio|https?:\/\/(?!.*github|.*linkedin))/i.test(line)) || "",
    summary,
    skills: parseSkills([...skillLines, resumeText]),
    experience: [
      {
        title: experienceTitle || "QA Analyst | Frontend Developer",
        company: companyLine || "Company",
        duration: durationLine,
        points: bulletize(
          experienceLines.filter(
            (line) =>
              line !== experienceTitle &&
              line !== companyLine &&
              line !== durationLine &&
              !isProjectLikeLine(line) &&
              !isEducationLikeLine(line) &&
              !/^(PERSONAL DETAILS|LANGUAGES|ENGLISH|HINDI)$/i.test(line)
          ),
          10
        )
      }
    ].filter((item) => item.points.length),
    projects: unique(projectLines.filter((line) => /admin panel|erp|application|dham|project/i.test(line)), 6).map((title) => {
      const index = projectLines.indexOf(title)
      return {
        title,
        stack: /react|html|css|api/i.test(resumeText) ? "React.js, HTML, CSS, REST APIs" : "",
        points: bulletize(projectLines.slice(index + 1, index + 6), 3)
      }
    }),
    certifications: unique(sections.CERTIFICATIONS.filter((line) => /certification|certificate|certified/i.test(line)), 5),
    education: parseEducation(educationLines)
  }
}

export const renderResumeLatex = (payload: ResumeTemplateData) => {
  registerHelpers()
  return Handlebars.compile(RESUME_LATEX_HANDLEBARS_TEMPLATE, { noEscape: true })(payload)
}
