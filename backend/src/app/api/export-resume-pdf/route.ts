import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

import { NextRequest } from "next/server"

import { DEFAULT_RESUME_LATEX_TEMPLATE } from "@/lib/default-resume-template"
import type { ResumeTemplateData } from "@/lib/dynamic-resume-template"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const runPdflatex = (binary: string, cwd: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(binary, ["-interaction=nonstopmode", "resume.tex"], { cwd })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", (error) => reject(error))
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `pdflatex exited with code ${code}`))
    })
  })

const runTectonic = (binary: string, cwd: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(binary, ["resume.tex", "--outfmt", "pdf"], { cwd })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", (error) => reject(error))
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `tectonic exited with code ${code}`))
    })
  })

const runLatexCompilerWithFallback = async (cwd: string) => {
  const candidates = [
    { kind: "pdflatex" as const, binary: process.env.PDFLATEX_PATH },
    { kind: "pdflatex" as const, binary: "pdflatex" },
    { kind: "pdflatex" as const, binary: "/Library/TeX/texbin/pdflatex" },
    { kind: "pdflatex" as const, binary: "/opt/homebrew/bin/pdflatex" },
    { kind: "pdflatex" as const, binary: "/usr/texbin/pdflatex" },
    { kind: "tectonic" as const, binary: process.env.TECTONIC_PATH },
    { kind: "tectonic" as const, binary: "tectonic" }
  ].filter((item) => Boolean(item.binary)) as Array<{ kind: "pdflatex" | "tectonic"; binary: string }>

  let lastError: Error | null = null
  for (const candidate of candidates) {
    try {
      if (candidate.kind === "pdflatex") {
        await runPdflatex(candidate.binary, cwd)
      } else {
        await runTectonic(candidate.binary, cwd)
      }
      return
    } catch (error) {
      lastError = error as Error
    }
  }

  throw lastError || new Error("No LaTeX compiler binary found")
}

const compileWithRemoteLatexService = async (latexSource: string) => {
  const envValue = process.env.LATEX_REMOTE_COMPILER_URL?.trim()
  if (envValue && /^(off|false|disabled)$/i.test(envValue)) return null
  const remoteBaseUrl = envValue || "https://latexonline.cc"

  const compileUrl = new URL("/compile", remoteBaseUrl)
  compileUrl.searchParams.set("command", "pdflatex")
  compileUrl.searchParams.set("text", latexSource)

  const response = await fetch(compileUrl.toString())
  if (!response.ok) {
    const details = await response.text().catch(() => "")
    throw new Error(`Remote LaTeX compile failed (${response.status}). ${details}`.trim())
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/pdf")) {
    const details = await response.text().catch(() => "")
    throw new Error(`Remote LaTeX compile did not return PDF. ${details}`.trim())
  }

  const bytes = await response.arrayBuffer()
  return Buffer.from(bytes)
}

const stripLatexToText = (latex: string) =>
  latex
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, "\n")
    .replace(/\\section\{([^}]+)\}/g, "\n$1\n")
    .replace(/\\item\s+/g, "• ")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\$+\|?\$+/g, " | ")
    .replace(/\s+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim()

const buildPlainPdf = async (text: string) => {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const lineHeight = 14
  let y = margin

  doc.setFont("times", "normal")
  doc.setFontSize(10)

  const lines = doc.splitTextToSize(text || "Resume content unavailable.", pageWidth - margin * 2)
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(String(line), margin, y)
    y += lineHeight
  }

  const bytes = doc.output("arraybuffer")
  return Buffer.from(bytes)
}

const cleanResumeTextForPdf = (text: string) =>
  text
    .replace(/\r/g, "")
    .split(/\n\s*JOBDESCRIPTION:/i)[0]
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")

const buildStyledTextPdf = async (text: string) => {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 32
  const contentWidth = pageWidth - margin * 2
  let y = 40

  const lines = cleanResumeTextForPdf(text).split("\n")
  const nameIndex = lines.findIndex((line) => /^[A-Z][A-Z\s.'-]{3,45}$/.test(line) && line.split(/\s+/).length >= 2)
  const name = nameIndex >= 0 ? lines[nameIndex] : "RESUME"
  const phone = lines.find((line) => /^\+?\d[\d\s().-]{7,}\d$/.test(line)) || ""
  const email = lines.find((line) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line)) || ""
  const location = lines.find((line) => /bihar|patna|supaul|india|delhi|bengaluru|pune/i.test(line) && !line.includes("@")) || ""
  const bodyLines = lines.filter((line, index) => index !== nameIndex && line !== phone && line !== email && line !== location)

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return
    doc.addPage()
    y = margin
  }

  const textLine = (value: string, options: { bold?: boolean; italic?: boolean; size?: number; indent?: number } = {}) => {
    const size = options.size || 10
    const indent = options.indent || 0
    doc.setFont("times", options.bold ? "bold" : options.italic ? "italic" : "normal")
    doc.setFontSize(size)
    const wrapped = doc.splitTextToSize(value, contentWidth - indent)
    ensureSpace(wrapped.length * (size + 3))
    for (const wrappedLine of wrapped) {
      doc.text(String(wrappedLine), margin + indent, y)
      y += size + 3
    }
  }

  const section = (title: string) => {
    ensureSpace(28)
    y += 8
    doc.setFont("times", "bold")
    doc.setFontSize(16)
    doc.text(title.toUpperCase(), margin, y)
    y += 5
    doc.setLineWidth(0.4)
    doc.line(margin, y, pageWidth - margin, y)
    y += 14
  }

  doc.setFont("times", "bold")
  doc.setFontSize(26)
  doc.text(name, pageWidth / 2, y, { align: "center" })
  y += 18
  doc.setFont("times", "normal")
  doc.setFontSize(10)
  doc.text([location, phone ? `Phone: ${phone}` : "", email ? `Email: ${email}` : ""].filter(Boolean).join(" | "), pageWidth / 2, y, {
    align: "center"
  })
  y += 26

  section("Summary")
  const firstSkillIndex = bodyLines.findIndex((line) => /^(Test .*Tools|Test Framework|Development Environment|Programming language|API Testing Tool|Version Control|Bug Tracking Tool|Mobile Testing|Methodologies|Test Management Tool|Operating System|Skills:)/i.test(line))
  const roleIndex = bodyLines.findIndex(
    (line, index) => index > Math.max(firstSkillIndex, 0) && /^(QA Analyst|Frontend Developer)|QA Analyst\s*\|/i.test(line)
  )
  const summaryEnd = firstSkillIndex >= 0 ? firstSkillIndex : roleIndex >= 0 ? roleIndex : Math.min(bodyLines.length, 5)
  bodyLines.slice(0, summaryEnd).filter((line) => !/^\d{1,2}\/\d{1,2}\/\d{4}|^- Till Now$/i.test(line)).forEach((line) => textLine(line, { size: 11 }))

  section("Skills")
  const skillEnd = roleIndex >= 0 ? roleIndex : bodyLines.length
  const skillLines = firstSkillIndex >= 0 ? bodyLines.slice(firstSkillIndex, skillEnd) : []
  skillLines.forEach((line) => textLine(line.replace(/^Skills:\s*/i, ""), { size: 10 }))

  section("Experience")
  const educationIndex = bodyLines.findIndex((line) => /^MATRIC$/i.test(line))
  const experienceStart = roleIndex >= 0 ? roleIndex : skillEnd
  const experienceEnd = educationIndex >= 0 ? educationIndex : bodyLines.length
  bodyLines
    .slice(experienceStart, experienceEnd)
    .filter((line) => !/^(OBJECTIVE|TECHNICAL SKILLS|PROFESSIONAL EXPERIENCE|WEB DEVELOPMENT PROJECTS|LATEST PROJECTS)$/i.test(line))
    .forEach((line) => {
    if (/QA Analyst|Frontend Developer|Engineer/i.test(line)) textLine(line, { bold: true, size: 11 })
    else if (/solutions|private|limited|pvt/i.test(line)) textLine(line, { italic: true, size: 10 })
    else textLine(`• ${line.replace(/^[•*-]\s*/, "")}`, { size: 10, indent: 8 })
    })

  if (educationIndex >= 0) {
    section("Education")
    const educationLines = bodyLines.slice(educationIndex).filter((line) => !/^(Date of Birth|Marital Status|Nationality|ENGLISH|HINDI|PERSONAL DETAILS|LANGUAGES)$/i.test(line) && !/^:/.test(line))
    for (let i = 0; i < educationLines.length; i += 2) {
      textLine(educationLines[i], { bold: /^(MATRIC|INTER|BCA|MCA)$/i.test(educationLines[i]), size: 11 })
      if (educationLines[i + 1] && !/^(MATRIC|INTER|BCA|MCA)$/i.test(educationLines[i + 1])) {
        textLine(educationLines[i + 1], { italic: true, size: 10 })
      } else if (educationLines[i + 1]) {
        i -= 1
      }
    }
  }

  return Buffer.from(doc.output("arraybuffer"))
}

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

const buildResumeDataPdf = async (resume: ResumeTemplateData) => {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 32
  const width = pageWidth - margin * 2
  let y = 42

  const ensure = (height: number) => {
    if (y + height <= pageHeight - margin) return
    doc.addPage()
    y = margin
  }
  const write = (text: string, options: { size?: number; bold?: boolean; italic?: boolean; indent?: number; align?: "left" | "center" } = {}) => {
    if (!text.trim()) return
    const size = options.size || 10
    const indent = options.indent || 0
    const lineHeight = size + 3
    doc.setFont("times", options.bold ? "bold" : options.italic ? "italic" : "normal")
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, width - indent)
    ensure(lines.length * lineHeight)
    for (const line of lines) {
      doc.text(String(line), options.align === "center" ? pageWidth / 2 : margin + indent, y, {
        align: options.align || "left"
      })
      y += lineHeight
    }
  }
  const section = (title: string) => {
    ensure(28)
    y += 8
    doc.setFont("times", "bold")
    doc.setFontSize(15)
    doc.text(title.toUpperCase(), margin, y)
    y += 5
    doc.setLineWidth(0.4)
    doc.line(margin, y, pageWidth - margin, y)
    y += 13
  }
  const skillLine = (label: string, items?: string[]) => {
    if (!items?.length) return
    write(`${label}: ${items.join(", ")}`, { size: 10, bold: label === "Languages" })
  }

  doc.setFont("times", "bold")
  doc.setFontSize(26)
  doc.text(resume.name.toUpperCase(), pageWidth / 2, y, { align: "center" })
  y += 18
  write(
    [resume.location, resume.phone ? `Phone: ${resume.phone}` : "", resume.email ? `Email: ${resume.email}` : ""]
      .filter(Boolean)
      .join(" | "),
    { size: 10, align: "center" }
  )
  const links = [resume.github, resume.linkedin, resume.portfolio].filter(Boolean).join(" | ")
  if (links) write(links, { size: 9, align: "center", italic: true })
  y += 10

  if (resume.summary) {
    section("Summary")
    write(resume.summary, { size: 11 })
  }

  section("Skills")
  skillLine("Languages", resume.skills.languages)
  skillLine("Frontend", resume.skills.frontend)
  skillLine("Backend & Tools", resume.skills.backend_tools)
  skillLine("Libraries", resume.skills.libraries)
  skillLine("Testing", resume.skills.testing)
  skillLine("Data", resume.skills.data)

  if (resume.experience.length) {
    section("Experience")
    for (const item of resume.experience) {
      write(`${item.title}${item.duration ? `    ${item.duration}` : ""}`, { size: 11, bold: true })
      write([item.company, item.location].filter(Boolean).join(", "), { size: 10, italic: true })
      item.points.forEach((point) => write(`• ${point}`, { size: 10, indent: 8 }))
      y += 3
    }
  }

  if (resume.projects.length) {
    section("Projects")
    for (const item of resume.projects) {
      write(item.title, { size: 11, bold: true })
      write(item.stack || "", { size: 10, italic: true })
      item.points.forEach((point) => write(`• ${point}`, { size: 10, indent: 8 }))
      y += 3
    }
  }

  if (resume.certifications?.length) {
    section("Certifications")
    resume.certifications.forEach((cert) => write(`• ${cert}`, { size: 10, indent: 8 }))
  }

  if (resume.education.length) {
    section("Education")
    for (const item of resume.education) {
      write(`${item.degree}${item.duration ? `    ${item.duration}` : ""}`, { size: 11, bold: true })
      write(item.institution, { size: 10, italic: true })
      y += 3
    }
  }

  return Buffer.from(doc.output("arraybuffer"))
}

export async function POST(request: NextRequest) {
  const workspace = path.join(os.tmpdir(), `interviewmint-${randomUUID()}`)

  try {
    const { latex_source, resume_data, resume_text, job_title } = await request.json()
    const parsedResumeData = normalizeResumeData(resume_data)
    if (parsedResumeData) {
      const pdfBuffer = await buildResumeDataPdf(parsedResumeData)
      const safeTitle = String(job_title || "optimized-resume")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()

      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeTitle || "optimized-resume"}-interviewmint.pdf"`,
          "x-interviewmint-pdf-source": "resume-data"
        }
      })
    }

    if (typeof resume_text === "string" && resume_text.trim()) {
      const pdfBuffer = await buildStyledTextPdf(resume_text)
      const safeTitle = String(job_title || "optimized-resume")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()

      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeTitle || "optimized-resume"}-interviewmint.pdf"`,
          "x-interviewmint-pdf-source": "resume-text"
        }
      })
    }

    const tex = typeof latex_source === "string" && latex_source.trim() ? latex_source : DEFAULT_RESUME_LATEX_TEMPLATE

    await fs.mkdir(workspace, { recursive: true })
    await fs.writeFile(path.join(workspace, "resume.tex"), tex, "utf8")

    const pdfPath = path.join(workspace, "resume.pdf")
    try {
      await runLatexCompilerWithFallback(workspace)
    } catch (error) {
      try {
        const remotePdf = await compileWithRemoteLatexService(tex)
        if (remotePdf) {
          const safeTitle = String(job_title || "optimized-resume")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase()

          return new Response(remotePdf, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${safeTitle || "optimized-resume"}-interviewmint.pdf"`
            }
          })
        }
      } catch (remoteCompileError) {
        const fallbackText =
          typeof resume_text === "string" && resume_text.trim() ? resume_text : stripLatexToText(tex)
        const plainPdf = await buildPlainPdf(fallbackText)
        const safeTitle = String(job_title || "optimized-resume")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()
        return new Response(plainPdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${safeTitle || "optimized-resume"}-interviewmint.pdf"`,
            "x-interviewmint-pdf-fallback": "plain-text"
          }
        })
      }

      // Some LaTeX runs return non-zero on warnings but still emit a valid PDF.
      try {
        await fs.access(pdfPath)
      } catch {
        return Response.json(
          {
            error:
              "LaTeX compiler not available or failed. Install MacTeX (`brew install --cask mactex`) or provide `PDFLATEX_PATH`/`TECTONIC_PATH`. For serverless, set `LATEX_REMOTE_COMPILER_URL` (example: `https://latexonline.cc`).",
            details: (error as Error).message
          },
          { status: 500 }
        )
      }
    }

    const pdfBuffer = await fs.readFile(pdfPath)
    const safeTitle = String(job_title || "optimized-resume")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle || "optimized-resume"}-interviewmint.pdf"`
      }
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message || "PDF export failed" }, { status: 500 })
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => undefined)
  }
}
