import { NextRequest } from "next/server"

import {
  buildResumeTemplateDataFromText,
  type ResumeTemplateData
} from "@/lib/dynamic-resume-template"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const sanitizeFilename = (value: unknown) =>
  String(value || "optimized-resume")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "optimized-resume"

const cleanResumeTextForPdf = (text: string) =>
  text
    .replace(/\r/g, "")
    .split(/\n\s*JOBDESCRIPTION:/i)[0]
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")

const stripLatexToText = (latex: string) =>
  latex
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, "\n")
    .replace(/\\section\{([^}]+)\}/g, "\n$1\n")
    .replace(/\\item\s+/g, "• ")
    .replace(/\\(?:href|textbf|textit|underline)\{([^}]*)\}(?:\{([^}]*)\})?/g, (_, first, second) =>
      second ? `${first} ${second}` : first
    )
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\$+\|?\$+/g, " | ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const list = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : []

const normalizeResumeData = (value: any): ResumeTemplateData | null => {
  if (!value || typeof value !== "object") return null

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
          points: list(item?.points)
        }))
        .filter((item: ExperienceItem) => item.title || item.company || item.points.length)
    : []

  const projects = Array.isArray(value.projects)
    ? value.projects
        .map((item: any) => ({
          title: String(item?.title ?? "").trim(),
          stack: String(item?.stack ?? "").trim(),
          points: list(item?.points)
        }))
        .filter((item: ProjectItem) => item.title || item.points.length)
    : []

  const education = Array.isArray(value.education)
    ? value.education
        .map((item: any) => ({
          degree: String(item?.degree ?? "").trim(),
          institution: String(item?.institution ?? "").trim(),
          duration: String(item?.duration ?? "").trim()
        }))
        .filter((item: EducationItem) => item.degree || item.institution)
    : []

  return {
    name: String(value.name ?? "Resume").trim() || "Resume",
    phone: String(value.phone ?? "").trim(),
    email: String(value.email ?? "").trim(),
    location: String(value.location ?? "").trim(),
    github: String(value.github ?? "").trim(),
    linkedin: String(value.linkedin ?? "").trim(),
    portfolio: String(value.portfolio ?? "").trim(),
    summary: String(value.summary ?? "").trim(),
    skills: {
      languages: list(skills.languages),
      frontend: list(skills.frontend),
      backend_tools: list(skills.backend_tools),
      libraries: list(skills.libraries),
      testing: list(skills.testing),
      data: list(skills.data)
    },
    experience,
    projects,
    certifications: list(value.certifications),
    education
  }
}

const hasStructuredContent = (resume: ResumeTemplateData | null) =>
  Boolean(
    resume &&
      (
        resume.summary ||
        Object.values(resume.skills).some((items) => items?.length) ||
        resume.experience.length ||
        resume.projects.length ||
        resume.certifications?.length ||
        resume.education.length
      )
  )

const buildFallbackResumeData = (resumeText: string): ResumeTemplateData => {
  const cleaned = cleanResumeTextForPdf(resumeText)
  const parsed = buildResumeTemplateDataFromText(cleaned)
  return {
    ...parsed,
    name: parsed.name || "Resume",
    summary: parsed.summary || cleaned.split("\n").slice(0, 3).join(" ")
  }
}

const buildPlainPdf = async (text: string) => {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const width = pageWidth - margin * 2
  let y = margin

  doc.setFont("times", "normal")
  doc.setFontSize(10.5)

  const lines = doc.splitTextToSize(text || "Resume content unavailable.", width)
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(String(line), margin, y)
    y += 14
  }

  return Buffer.from(doc.output("arraybuffer"))
}

const buildResumeDataPdf = async (resume: ResumeTemplateData) => {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 34
  const width = pageWidth - margin * 2
  const accent = [38, 70, 83] as const
  const muted = [92, 92, 92] as const
  let y = 38

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return
    doc.addPage()
    y = margin
  }

  const writeBlock = (
    text: string,
    options: {
      size?: number
      bold?: boolean
      italic?: boolean
      align?: "left" | "center" | "right"
      color?: readonly [number, number, number]
      indent?: number
      gap?: number
    } = {}
  ) => {
    if (!text.trim()) return

    const size = options.size ?? 10
    const indent = options.indent ?? 0
    const lineHeight = size + 3
    const lines = doc.splitTextToSize(text, width - indent)
    ensureSpace(lines.length * lineHeight + (options.gap ?? 0))

    doc.setFont("times", options.bold ? "bold" : options.italic ? "italic" : "normal")
    doc.setFontSize(size)
    if (options.color) doc.setTextColor(...options.color)
    else doc.setTextColor(20, 20, 20)

    for (const line of lines) {
      const x =
        options.align === "center"
          ? pageWidth / 2
          : options.align === "right"
          ? pageWidth - margin
          : margin + indent
      doc.text(String(line), x, y, { align: options.align ?? "left" })
      y += lineHeight
    }

    y += options.gap ?? 0
  }

  const writeBullet = (text: string) => {
    const bulletX = margin + 8
    const textX = margin + 18
    const lines = doc.splitTextToSize(text, width - 18)
    ensureSpace(lines.length * 13 + 2)
    doc.setFont("times", "normal")
    doc.setFontSize(10)
    doc.setTextColor(20, 20, 20)
    doc.text("•", bulletX, y)
    lines.forEach((line: string, index: number) => {
      doc.text(String(line), textX, y + index * 13)
    })
    y += lines.length * 13 + 2
  }

  const section = (title: string) => {
    ensureSpace(30)
    y += 8
    doc.setDrawColor(...accent)
    doc.setFillColor(...accent)
    doc.roundedRect(margin, y - 11, 6, 6, 1.2, 1.2, "F")
    doc.setFont("times", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...accent)
    doc.text(title.toUpperCase(), margin + 12, y - 6)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageWidth - margin, y)
    doc.setTextColor(20, 20, 20)
    y += 14
  }

  const writeLabeledSkills = (label: string, items?: string[]) => {
    if (!items?.length) return
    const labelText = `${label}: `
    doc.setFont("times", "bold")
    doc.setFontSize(10)
    const labelWidth = doc.getTextWidth(labelText)
    const wrapped = doc.splitTextToSize(items.join(", "), width - labelWidth)
    ensureSpace(wrapped.length * 13 + 2)

    doc.setTextColor(20, 20, 20)
    doc.text(labelText, margin, y)
    doc.setFont("times", "normal")
    wrapped.forEach((line: string, index: number) => {
      doc.text(String(line), margin + labelWidth, y + index * 13)
    })
    y += wrapped.length * 13 + 2
  }

  const writeTimelineRow = (title: string, subtitle: string, duration?: string) => {
    ensureSpace(28)
    doc.setFont("times", "bold")
    doc.setFontSize(11)
    doc.setTextColor(20, 20, 20)

    const durationText = duration?.trim() || ""
    const durationWidth = durationText ? doc.getTextWidth(durationText) : 0
    const titleWidth = durationText ? width - durationWidth - 14 : width
    const titleLines = doc.splitTextToSize(title, titleWidth)

    titleLines.forEach((line: string, index: number) => {
      doc.text(String(line), margin, y + index * 13)
    })
    if (durationText) {
      doc.setTextColor(...muted)
      doc.text(durationText, pageWidth - margin, y, { align: "right" })
      doc.setTextColor(20, 20, 20)
    }
    y += titleLines.length * 13

    if (subtitle.trim()) {
      writeBlock(subtitle, { size: 10, italic: true, color: muted, gap: 1 })
    }
  }

  doc.setDrawColor(...accent)
  doc.setLineWidth(3)
  doc.line(margin, 22, pageWidth - margin, 22)

  writeBlock(resume.name.toUpperCase(), { size: 22, bold: true, align: "center", color: accent, gap: 2 })

  const contactLine = [
    resume.location,
    resume.phone ? `Phone: ${resume.phone}` : "",
    resume.email ? `Email: ${resume.email}` : ""
  ]
    .filter(Boolean)
    .join(" | ")
  if (contactLine) {
    writeBlock(contactLine, { size: 10, align: "center", color: muted, gap: 2 })
  }

  const linksLine = [resume.github, resume.linkedin, resume.portfolio].filter(Boolean).join(" | ")
  if (linksLine) {
    writeBlock(linksLine, { size: 9.5, align: "center", italic: true, color: muted, gap: 8 })
  } else {
    y += 6
  }

  if (resume.summary) {
    section("Summary")
    writeBlock(resume.summary, { size: 10.5, gap: 2 })
  }

  if (Object.values(resume.skills).some((items) => items?.length)) {
    section("Skills")
    writeLabeledSkills("Languages", resume.skills.languages)
    writeLabeledSkills("Frontend", resume.skills.frontend)
    writeLabeledSkills("Backend & Tools", resume.skills.backend_tools)
    writeLabeledSkills("Libraries", resume.skills.libraries)
    writeLabeledSkills("Testing", resume.skills.testing)
    writeLabeledSkills("Data", resume.skills.data)
  }

  if (resume.experience.length) {
    section("Experience")
    for (const item of resume.experience) {
      writeTimelineRow(item.title, [item.company, item.location].filter(Boolean).join(", "), item.duration)
      item.points.forEach((point) => writeBullet(point.replace(/^[•*-]\s*/, "")))
      y += 4
    }
  }

  if (resume.projects.length) {
    section("Projects")
    for (const item of resume.projects) {
      writeTimelineRow(item.title, item.stack || "", "")
      item.points.forEach((point) => writeBullet(point.replace(/^[•*-]\s*/, "")))
      y += 4
    }
  }

  if (resume.certifications?.length) {
    section("Certifications")
    resume.certifications.forEach((item) => writeBullet(item.replace(/^[•*-]\s*/, "")))
  }

  if (resume.education.length) {
    section("Education")
    for (const item of resume.education) {
      writeTimelineRow(item.degree, item.institution, item.duration)
      y += 4
    }
  }

  return Buffer.from(doc.output("arraybuffer"))
}

export async function POST(request: NextRequest) {
  try {
    const { latex_source, resume_data, resume_text, job_title } = await request.json()

    const normalizedData = normalizeResumeData(resume_data)
    const textSource =
      typeof resume_text === "string" && resume_text.trim()
        ? cleanResumeTextForPdf(resume_text)
        : typeof latex_source === "string" && latex_source.trim()
        ? stripLatexToText(latex_source)
        : ""

    const resume =
      hasStructuredContent(normalizedData) ? normalizedData : textSource ? buildFallbackResumeData(textSource) : null

    const pdfBuffer = resume ? await buildResumeDataPdf(resume) : await buildPlainPdf("Resume content unavailable.")
    const safeTitle = sanitizeFilename(job_title)

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}-interviewmint.pdf"`,
        "x-interviewmint-pdf-source": resume ? (hasStructuredContent(normalizedData) ? "resume-data" : "resume-text") : "plain-text"
      }
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message || "PDF export failed" }, { status: 500 })
  }
}
