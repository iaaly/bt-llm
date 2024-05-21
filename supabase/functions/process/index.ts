import { createClient } from "@supabase/supabase-js";
import { Database } from "../_lib/database.ts";
// import { processMarkdown } from "../_lib/markdown-parser.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServerKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (!supabaseUrl) {
    return new Response(
      JSON.stringify({
        error: "Missing environment variables.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization && !supabaseServerKey) {
    return new Response(
      JSON.stringify({ error: `No authorization header passed` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const supabase = supabaseServerKey
    ? createClient<Database>(supabaseUrl, supabaseServerKey)
    : createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            authorization,
          },
        },
        auth: {
          persistSession: false,
        },
      });

  if (supabaseServerKey) {
    console.log("Using server key");
  }

  const { document_id } = await req.json();

  const { data: document } = await supabase
    .from("documents_with_storage_path")
    .select()
    .eq("id", document_id)
    .single();

  if (!document?.storage_object_path) {
    console.error("Document not found", document_id);
    return new Response(
      JSON.stringify({ error: "Failed to find uploaded document" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } else {
    console.log("Document found", document_id);
  }

  const { data: file } = await supabase.storage
    .from("files")
    .download(document.storage_object_path);

  if (!file) {
    return new Response(
      JSON.stringify({ error: "Failed to download storage object" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const fileContents = await file.text();
  // const processedMd = processMarkdown(fileContents);

  const { error } = await supabase.from("document_sections").insert([
    {
      document_id: document_id,
      content: fileContents,
    },
  ]);

  if (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Failed to save document sections" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // console.log(
  //   `Saved ${processedMd.sections.length} sections for file '${document.name}'`
  // );

  console.log(`Saved 1 section for file '${document.name}'`);

  return new Response(null, {
    status: 204,
    headers: { "Content-Type": "application/json" },
  });
});
