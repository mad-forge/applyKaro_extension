import { NextRequest, NextResponse } from "next/server"

type PdfParse = (dataBuffer: Buffer) => Promise<{ text: string; numpages: number }>

const PARSE_RESUME_ROUTE_VERSION = "parse-resume-pdf-lib-path-v2"

const loadPdfParser = (): PdfParse => {
  // Keep this require inside the handler path so route startup never fails if
  // the serverless trace is stale, while still letting Next trace the package.
  return require("pdf-parse/lib/pdf-parse.js") as PdfParse
}

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, route_version: PARSE_RESUME_ROUTE_VERSION })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Resume file is required" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = loadPdfParser()
      const parsed = await pdfParse(buffer)
      const text = parsed.text.replace(/\n{3,}/g, "\n\n").trim()

      if (!text) {
        return NextResponse.json({ error: "Could not extract text from this PDF" }, { status: 422 })
      }

      return NextResponse.json({ text, page_count: parsed.numpages })
    }

    return NextResponse.json({ text: buffer.toString("utf8").trim(), page_count: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
        route_version: PARSE_RESUME_ROUTE_VERSION
      },
      { status: 500 }
    )
  }
}
