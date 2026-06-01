import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

import { NextRequest } from "next/server"
import { jsPDF } from "jspdf"

import { DEFAULT_RESUME_LATEX_TEMPLATE } from "@/lib/default-resume-template"

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

const runPdflatexWithFallback = async (cwd: string) => {
  const candidates = [
    process.env.PDFLATEX_PATH,
    "pdflatex",
    "/Library/TeX/texbin/pdflatex",
    "/opt/homebrew/bin/pdflatex",
    "/usr/texbin/pdflatex"
  ].filter(Boolean) as string[]

  let lastError: Error | null = null
  for (const binary of candidates) {
    try {
      await runPdflatex(binary, cwd)
      return
    } catch (error) {
      lastError = error as Error
    }
  }

  throw lastError || new Error("No pdflatex binary found")
}

const createSimpleResumePdf = (resumeText: string, title: string) => {
  const doc = new jsPDF({ format: "letter", unit: "pt" })
  const marginX = 54
  const marginTop = 48
  const marginBottom = 48
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const textWidth = pageWidth - marginX * 2
  let y = marginTop

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - marginBottom) return
    doc.addPage()
    y = marginTop
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor("#16201d")
  doc.text(title || "Optimized Resume", marginX, y)
  y += 26

  const lines = resumeText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())

  for (const line of lines) {
    if (!line.trim()) {
      y += 8
      continue
    }

    const isLikelyHeading = line.length <= 42 && /^[A-Z][A-Z\s/&.-]+$/.test(line.trim())
    const fontSize = isLikelyHeading ? 11 : 9.5
    const lineHeight = isLikelyHeading ? 15 : 13
    const wrappedLines = doc.splitTextToSize(line, textWidth) as string[]

    ensureSpace(wrappedLines.length * lineHeight + 4)
    doc.setFont("helvetica", isLikelyHeading ? "bold" : "normal")
    doc.setFontSize(fontSize)
    doc.setTextColor(isLikelyHeading ? "#14563c" : "#25312d")
    doc.text(wrappedLines, marginX, y)
    y += wrappedLines.length * lineHeight + (isLikelyHeading ? 5 : 2)
  }

  return Buffer.from(doc.output("arraybuffer"))
}

export async function POST(request: NextRequest) {
  const workspace = path.join(os.tmpdir(), `interviewmint-${randomUUID()}`)

  try {
    const { latex_source, job_title, resume_text, optimized_resume_text } = await request.json()
    const tex = typeof latex_source === "string" && latex_source.trim() ? latex_source : DEFAULT_RESUME_LATEX_TEMPLATE
    const fallbackResumeText =
      typeof resume_text === "string" && resume_text.trim()
        ? resume_text
        : typeof optimized_resume_text === "string" && optimized_resume_text.trim()
          ? optimized_resume_text
          : ""

    await fs.mkdir(workspace, { recursive: true })
    await fs.writeFile(path.join(workspace, "resume.tex"), tex, "utf8")

    const pdfPath = path.join(workspace, "resume.pdf")
    try {
      await runPdflatexWithFallback(workspace)
    } catch (error) {
      // Some LaTeX runs return non-zero on warnings but still emit a valid PDF.
      try {
        await fs.access(pdfPath)
      } catch {
        if (!fallbackResumeText) {
          return Response.json(
            {
              error:
                "LaTeX compiler not available or failed. Install MacTeX (`brew install --cask mactex`) and retry.",
              details: (error as Error).message
            },
            { status: 500 }
          )
        }

        const safeTitle = String(job_title || "optimized-resume")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()
        const fallbackPdf = await createSimpleResumePdf(fallbackResumeText, String(job_title || "Optimized Resume"))

        return new Response(fallbackPdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${safeTitle || "optimized-resume"}-interviewmint.pdf"`
          }
        })
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
