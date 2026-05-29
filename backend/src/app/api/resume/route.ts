import { NextRequest, NextResponse } from "next/server"

import { getUserIdFromRequest } from "@/lib/auth"
import { ensureAppUser } from "@/lib/ensure-user"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()
    await ensureAppUser(supabaseAdmin, userId)

    const { data, error } = await supabaseAdmin
      .from("resumes")
      .select("base_resume, updated_at")
      .eq("user_id", userId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()
    await ensureAppUser(supabaseAdmin, userId)
    const { base_resume } = await request.json()

    if (!base_resume || typeof base_resume !== "string") {
      return NextResponse.json({ error: "base_resume is required" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("resumes")
      .upsert(
        {
          user_id: userId,
          base_resume,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      )
      .select("base_resume, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
