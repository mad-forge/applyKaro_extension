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

export async function POST(request: NextRequest) {
  const workspace = path.join(os.tmpdir(), `interviewmint-${randomUUID()}`)

  try {
    const { latex_source, job_title } = await request.json()
    const tex = typeof latex_source === "string" && latex_source.trim() ? latex_source : DEFAULT_RESUME_LATEX_TEMPLATE

    await fs.mkdir(workspace, { recursive: true })
    await fs.writeFile(path.join(workspace, "resume.tex"), tex, "utf8")

    const pdfPath = path.join(workspace, "resume.pdf")
    try {
      await runLatexCompilerWithFallback(workspace)
    } catch (error) {
      // Some LaTeX runs return non-zero on warnings but still emit a valid PDF.
      try {
        await fs.access(pdfPath)
      } catch {
        return Response.json(
          {
            error:
              "LaTeX compiler not available or failed. Install MacTeX (`brew install --cask mactex`) or provide `PDFLATEX_PATH`/`TECTONIC_PATH` on server.",
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
