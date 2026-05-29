import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

import { NextRequest } from "next/server"

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

export async function POST(request: NextRequest) {
  const workspace = path.join(os.tmpdir(), `interviewmint-${randomUUID()}`)

  try {
    const { latex_source, job_title } = await request.json()
    const tex = typeof latex_source === "string" && latex_source.trim() ? latex_source : DEFAULT_RESUME_LATEX_TEMPLATE

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
        return Response.json(
          {
            error:
              "LaTeX compiler not available or failed. Install MacTeX (`brew install --cask mactex`) and retry.",
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
