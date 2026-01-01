export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const apiKey = url.searchParams.get("api_key");

    // =========================
    // CORS Headers Helper
    // =========================
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Max-Age": "86400",
    };

    // =========================
    // Handle Preflight (OPTIONS)
    // =========================
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // =========================
    // Helper Response with CORS
    // =========================
    const sendJSON = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    };

    // =========================
    // AUTH (WAJIB)
    // =========================
    if (apiKey !== "kyoubou") {
      return sendJSON({ error: "Unauthorized" }, 401);
    }

    // =========================
    // Helper parse body
    // =========================
    const getInput = async () => {
      if (method === "GET") return {};
      try {
        return await request.json();
      } catch {
        return {};
      }
    };

    // =========================
    // Helper vec <-> JSON (D1 doesn't handle Blob well)
    // =========================
    const vecToJSON = (vec) => {
      if (!Array.isArray(vec)) return null;
      
      for (const v of vec) {
        if (typeof v !== "number") {
          throw new Error("vec must be an array of numbers");
        }
      }
      
      return JSON.stringify(vec);
    };

    const vecFromJSON = (jsonStr) => {
      if (!jsonStr) return null;
      try {
        const parsed = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };

    try {
      // =========================
      // ROUTE: /users
      // =========================
      if (path === "/users") {
        // ---------- GET ALL ----------
        if (method === "GET") {
          const { results } = await env.DB.prepare(
            "SELECT id, name, email, vec FROM users"
          ).all();

          const data = results.map((u) => ({
            ...u,
            vec: vecFromJSON(u.vec),
          }));

          return sendJSON(data);
        }

        // ---------- CREATE ----------
        if (method === "POST") {
          const { name, email, vec } = await getInput();

          if (!name || !email) {
            return sendJSON(
              { error: "Missing name or email" },
              400
            );
          }

          const vecJSON = vec ? vecToJSON(vec) : null;

          const result = await env.DB.prepare(`
            INSERT INTO users (name, email, vec)
            VALUES (?, ?, ?)
          `)
            .bind(name, email, vecJSON)
            .run();

          return sendJSON(
            { success: true, id: result.meta.last_row_id },
            201
          );
        }
      }

      // =========================
      // ROUTE: /users/:id
      // =========================
      if (path.startsWith("/users/")) {
        const id = path.split("/")[2];

        // ---------- GET ONE ----------
        if (method === "GET") {
          const user = await env.DB.prepare(
            "SELECT id, name, email, vec FROM users WHERE id = ?"
          )
            .bind(id)
            .first();

          if (!user) {
            return sendJSON({ error: "Not Found" }, 404);
          }

          user.vec = vecFromJSON(user.vec);
          return sendJSON(user);
        }

        // ---------- UPDATE ----------
        if (method === "PUT") {
          const { name, email, vec } = await getInput();

          if (!name || !email) {
            return sendJSON(
              { error: "Missing name or email" },
              400
            );
          }

          const vecJSON = vec ? vecToJSON(vec) : null;

          await env.DB.prepare(`
            UPDATE users
            SET name = ?, email = ?, vec = ?
            WHERE id = ?
          `)
            .bind(name, email, vecJSON, id)
            .run();

          return sendJSON({ message: "Updated successfully" });
        }

        // ---------- DELETE ----------
        if (method === "DELETE") {
          await env.DB.prepare(
            "DELETE FROM users WHERE id = ?"
          )
            .bind(id)
            .run();

          return sendJSON({ message: "Deleted successfully" });
        }
      }

      return sendJSON({ error: "Route not found" }, 404);
    } catch (err) {
      return sendJSON({ error: err.message }, 500);
    }
  },
};
