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

const findName = (lines: string[]) =>
  lines.find((line) => {
    const cleaned = cleanLine(line)
    return (
      /^[A-Za-z][A-Za-z\s.'-]{3,45}$/.test(cleaned) &&
      cleaned.split(/\s+/).length >= 2 &&
      !isHeading(cleaned) &&
      !/@|\d{4}|\d[\d\s().-]{7,}/.test(cleaned)
    )
  }) || "Your Name"

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

export const buildResumeTemplateDataFromText = (resumeText: string): ResumeTemplateData => {
  const lines = resumeText.replace(/\r/g, "").split("\n").map(cleanLine).filter(Boolean)
  const name = findName(lines.slice(0, 12))
  const email = lines.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
  const phone = lines.join(" ").match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || ""
  const location =
    lines.find((line) => /bihar|patna|supaul|delhi|india/i.test(line) && !/@|\d[\d\s().-]{7,}/.test(line)) || ""

  const summaryStart = lines.findIndex((line) => /detail-oriented|summary|objective/i.test(line))
  const summarySource = summaryStart >= 0 ? lines.slice(summaryStart, summaryStart + 5) : lines.slice(0, 8)
  const summary =
    bulletize(summarySource, 3).join(" ") ||
    "Resume summary optimized from uploaded resume content."

  const skillLines = lines.filter((line) => /tool|framework|environment|language|testing|git|jira|postman|react|css|html|javascript|cypress/i.test(line))
  const projectStart = lines.findIndex((line) => /project|admin panel|erp|application/i.test(line))
  const projectLines = projectStart >= 0 ? lines.slice(projectStart) : []
  const experienceStart = lines.findIndex((line) => /analyst|developer|engineer|company|solutions/i.test(line))
  const experienceLines = experienceStart >= 0 ? lines.slice(experienceStart, projectStart > experienceStart ? projectStart : experienceStart + 18) : []
  const educationLines = lines.filter((line) => /matric|inter|bca|mca|college|school|university/i.test(line))

  return {
    name,
    phone,
    email,
    location,
    github: lines.find((line) => /github\.com/i.test(line)) || "",
    linkedin: lines.find((line) => /linkedin\.com/i.test(line)) || "",
    portfolio: lines.find((line) => /(portfolio|https?:\/\/(?!.*github|.*linkedin))/i.test(line)) || "",
    summary,
    skills: parseSkills([...skillLines, resumeText]),
    experience: [
      {
        title: lines.find((line) => /analyst|developer|engineer/i.test(line)) || "QA Analyst | Frontend Developer",
        company: lines.find((line) => /solutions|limited|pvt|private/i.test(line)) || "Company",
        duration: lines.find((line) => /\b(20\d{2}|present|till now)\b/i.test(line)) || "",
        points: bulletize(experienceLines, 7)
      }
    ].filter((item) => item.points.length),
    projects: unique(projectLines.filter((line) => /admin panel|erp|application|dham|project/i.test(line)), 4).map((title) => ({
      title,
      stack: /react|html|css|api/i.test(resumeText) ? "React.js, HTML, CSS, REST APIs" : "",
      points: bulletize(projectLines.slice(projectLines.indexOf(title) + 1), 3)
    })),
    certifications: unique(lines.filter((line) => /certification|certificate|certified/i.test(line)), 5),
    education: educationLines.length
      ? educationLines.slice(0, 4).map((line) => ({
          degree: line,
          institution: "",
          duration: ""
        }))
      : []
  }
}

export const renderResumeLatex = (payload: ResumeTemplateData) => {
  registerHelpers()
  return Handlebars.compile(RESUME_LATEX_HANDLEBARS_TEMPLATE, { noEscape: true })(payload)
}
