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

export async function listContent(): Promise<ContentRecord[]> {
  if (!supabase) {
    const records = Object.keys(localStorage)
      .filter((key) => key.startsWith("content-seal:"))
      .map((key) => {
        const value = localStorage.getItem(key);
        return value ? (JSON.parse(value) as ContentRecord) : null;
      })
      .filter((record): record is ContentRecord => record !== null);

    return records.sort((left, right) =>
      (right.updated_at ?? "").localeCompare(left.updated_at ?? ""),
    );
  }

  const { data, error } = await supabase
    .from("content_seals")
    .select("author,title,description,source_url,content_hash,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentRecord[];
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
