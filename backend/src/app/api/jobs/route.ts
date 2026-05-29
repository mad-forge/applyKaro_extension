import { NextRequest, NextResponse } from "next/server"

import { getUserIdFromRequest } from "@/lib/auth"
import { ensureAppUser } from "@/lib/ensure-user"
import { getSupabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()
    await ensureAppUser(supabaseAdmin, userId)
    const threeDaysAgoIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    // Auto-cleanup: remove jobs older than 3 days for this user before returning latest list.
    const { error: cleanupError } = await supabaseAdmin
      .from("jobs")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", threeDaysAgoIso)

    if (cleanupError) {
      return NextResponse.json({ error: cleanupError.message }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("id, title, company, description, source_url, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: data })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()
    await ensureAppUser(supabaseAdmin, userId)
    const body = await request.json()

    const { title, company, description, source_url } = body

    if (!title || !company || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("jobs")
      .upsert(
        {
          user_id: userId,
          title,
          company,
          description,
          source_url,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,source_url" }
      )
      .select("id, title, company, status, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const supabaseAdmin = getSupabaseAdmin()
    await ensureAppUser(supabaseAdmin, userId)
    const { id, status } = await request.json()

    if (!id || !["applied", "interviewing", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid job status update" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, status, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
