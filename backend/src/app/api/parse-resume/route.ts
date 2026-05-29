import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Resume file is required" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = eval("require")("pdf-parse") as typeof import("pdf-parse")
      const parsed = await pdfParse(buffer)
      const text = parsed.text.replace(/\n{3,}/g, "\n\n").trim()

      if (!text) {
        return NextResponse.json({ error: "Could not extract text from this PDF" }, { status: 422 })
      }

      return NextResponse.json({ text, page_count: parsed.numpages })
    }

    return NextResponse.json({ text: buffer.toString("utf8").trim(), page_count: null })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
