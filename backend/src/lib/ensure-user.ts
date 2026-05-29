import type { SupabaseClient } from "@supabase/supabase-js"

export const ensureAppUser = async (supabase: SupabaseClient, userId: string) => {
  const { error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        email: `${userId}@interviewmint.local`
      },
      { onConflict: "id" }
    )

  if (error) {
    throw new Error(
      `User bootstrap failed: ${error.message}. If you see auth/users foreign key errors, run backend/supabase/migrations/001_remove_auth_users_fk.sql in Supabase SQL editor.`
    )
  }
}
