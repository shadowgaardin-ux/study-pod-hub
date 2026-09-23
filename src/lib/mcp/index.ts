import { auth, defineMcp } from "@lovable.dev/mcp-js";

import createFlashcardsTool from "./tools/create-flashcards";
import createNoteTool from "./tools/create-note";
import listFlashcardsTool from "./tools/list-flashcards";
import listNotesTool from "./tools/list-notes";
import listPodsTool from "./tools/list-pods";
import searchNotesTool from "./tools/search-notes";

// The OAuth issuer must be the direct Supabase host; the project ref is inlined at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "study-pods-hub",
  title: "Study Pods Hub",
  version: "0.1.0",
  instructions:
    "Tools for Study Notes, a collaborative study workspace. Use `list_pods` to see the user's study pods, `list_notes` and `search_notes` to read their notes, recordings and transcripts, `create_note` to save new notes (personal library by default), and `list_flashcards` / `create_flashcards` to work with revision decks.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listPodsTool,
    listNotesTool,
    searchNotesTool,
    createNoteTool,
    listFlashcardsTool,
    createFlashcardsTool,
  ],
});
