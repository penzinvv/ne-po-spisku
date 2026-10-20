
export default async (request, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: corsHeaders
    });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const secretKey = Netlify.env.get("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
    return json({ error: "Server configuration is missing" }, 500);
  }

  const endpoint =
    `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/scores`;

  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  try {
    if (request.method === "GET") {
      const response = await fetch(
        `${endpoint}?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10`,
        { headers }
      );

      if (!response.ok) {
        const details = await response.text();
        console.error("Supabase GET error:", response.status, details);

        return json({
          error: "Could not load scores",
          supabase_status: response.status,
          details: details.slice(0, 500)
        }, 502);
      }

      const scores = await response.json();
      return json({ scores });
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const playerName =
      typeof body?.player_name === "string"
        ? body.player_name.trim().slice(0, 18)
        : "";

    const score = body?.score;

    if (
      !playerName ||
      !Number.isInteger(score) ||
      score < -1000000 ||
      score > 1000000
    ) {
      return json({ error: "Invalid player name or score" }, 400);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        player_name: playerName,
        score
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Supabase POST error:", response.status, details);

      return json({
        error: "Could not save score",
        supabase_status: response.status,
        details: details.slice(0, 500)
      }, 502);
    }

    return json({ ok: true }, 201);
  } catch (error) {
    console.error("Score function error:", error);

    return json({ error: "Unexpected server error" }, 500);
  }
};
