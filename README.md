# English Learning MN — V1 Starter

This starter contains:
- `public/index.html`: the interactive front-end prototype.
- `netlify/functions/ai-feedback.mjs`: server-side AI feedback endpoint.
- `supabase/schema.sql`: initial database tables and row-level security policies.
- `.env.example`: environment variable names.

## 1. Run the prototype locally
Open `public/index.html` in a modern browser. The current prototype uses browser-local storage for the teacher's sample content. It does not yet connect to Supabase or the AI endpoint.

## 2. Configure Netlify
Deploy this folder as a Netlify site. Netlify detects functions in `netlify/functions`.

Set these environment variables in Netlify:
- `OPENAI_API_KEY`: your private API key.
- `OPENAI_MODEL`: optional model name; defaults to `gpt-4o-mini`.

The function endpoint will be:
`/.netlify/functions/ai-feedback`

Example request:
```json
{
  "taskType": "translation",
  "level": "B1",
  "prompt": "Translate: Tôi thích đọc sách.",
  "studentAnswer": "I enjoy reading books.",
  "referenceAnswer": "I like reading books."
}
```

The endpoint returns structured feedback. The API key remains server-side. Do not put secrets in `public/index.html` or any `VITE_`/client-exposed variable.

## 3. Configure Supabase
1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Enable email authentication and configure allowed redirect URLs.
5. Build the sign-up/profile provisioning and class-join flows before using real student accounts.

The schema is a starting point, not a fully audited production security implementation. Test RLS with separate teacher and student accounts before storing student work.

## 4. Important current limitations
- The supplied front end is a prototype and does not yet call the AI function.
- Supabase tables are defined but the front end is not yet connected.
- No file upload, class join-code workflow, or assignment workflow is wired up yet.
- Speaking audio is recorded in the browser only; it is not uploaded or assessed.
- AI feedback is a learning aid, not an official IELTS band score.

## 5. Recommended implementation order
1. Connect Supabase authentication and profile roles.
2. Connect exercise creation and teacher content library.
3. Add class creation, student enrollment and assignment distribution.
4. Connect submissions to the AI feedback function.
5. Add teacher analytics, exports and file uploads.
6. Add speech-to-text and speaking assessment with consent and clear retention rules.
