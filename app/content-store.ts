import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ContentRecord = {
  author: string;
  title: string;
  description: string;
  source_url: string;
  content_hash: string;
  updated_at?: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase: SupabaseClient | null =
  supabaseUrl && publishableKey
    ? createClient(supabaseUrl, publishableKey)
    : null;

export const contentStoreLabel = supabase ? "Supabase" : "almacenamiento local";

export async function loadContent(
  author: string,
): Promise<ContentRecord | null> {
  if (!supabase) {
    const value = localStorage.getItem(`content-seal:${author}`);
    return value ? (JSON.parse(value) as ContentRecord) : null;
  }

  const { data, error } = await supabase
    .from("content_seals")
    .select("author,title,description,source_url,content_hash,updated_at")
    .eq("author", author)
    .maybeSingle();
  if (error) throw error;
  return data as ContentRecord | null;
}

export async function saveContent(record: ContentRecord): Promise<void> {
  if (!supabase) {
    localStorage.setItem(
      `content-seal:${record.author}`,
      JSON.stringify(record),
    );
    return;
  }

  const { error } = await supabase.from("content_seals").upsert(record, {
    onConflict: "author",
  });
  if (error) throw error;
}
