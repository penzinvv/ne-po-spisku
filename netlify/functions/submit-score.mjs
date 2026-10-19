export default async (request, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!["GET", "POST"].includes(request.method)) {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const secretKey = Netlify.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !secretKey) {
    return Response.json({ error: "Server configuration is missing" }, { status: 500, headers: corsHeaders });
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/scores`;
  const headers = {
    "apikey": secretKey,
    "Authorization": `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  try {
    if (request.method === "GET") {
      const response = await fetch(`${endpoint}?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10`, { headers });
      if (!response.ok) {
  const details = await response.text();
  return Response.json({
    error: "Could not load scores",
    supabase_status: response.status,
    details: details.slice(0, 500)
  }, { status: 502, headers: corsHeaders });
}
      return Response.json({ scores: await response.json() }, { status: 200, headers: corsHeaders });
    }

    let body;
    try { body = await request.json(); } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
    }
    const playerName = typeof body.player_name === "string" ? body.player_name.trim().slice(0, 18) : "";
    const score = body.score;
    if (!playerName || !Number.isInteger(score) || score < 0 || score > 1000000) {
      return Response.json({ error: "Invalid player name or score" }, { status: 400, headers: corsHeaders });
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=minimal" },
      body: JSON.stringify({ player_name: playerName, score })
    });
if (!response.ok) {
  const details = await response.text();
  console.error("Supabase read error:", response.status, details);
  return Response.json(
    {
      error: "Could not load scores",
      supabase_status: response.status,
      details: details.slice(0, 500)
    },
    { status: 502, headers: corsHeaders }
  );
}
    return Response.json({ ok: true }, { status: 201, headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unexpected server error" }, { status: 500, headers: corsHeaders });
  }
};
