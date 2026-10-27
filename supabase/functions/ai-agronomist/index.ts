// NuKropAI Server-Side Secure AI Agronomist Edge Function
// Zero-Client-Key-Leak Architecture: Keeps LLM API keys on the server side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, languageCode, cropContext } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "Missing agricultural query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langNames: Record<string, string> = {
      te: "Telugu",
      hi: "Hindi",
      ta: "Tamil",
      kn: "Kannada",
      ml: "Malayalam",
      mr: "Marathi",
      bn: "Bengali",
      gu: "Gujarati",
      pa: "Punjabi",
      or: "Odia",
      en: "English",
    };
    const targetLang = langNames[languageCode || "te"] || "Telugu";

    // Server-side environment variables (never sent to mobile client)
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    let aiResponseText = "";

    // Primary: Google Gemini 3.8 Flash
    if (geminiApiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const systemInstruction = `You are NuKropAI, an elite agronomist and crop protection scientist assisting Indian farmers.
Provide practical, scientifically accurate, location-appropriate agricultural advice on crop diseases, pest dosages, and soil health.
CRITICAL REQUIREMENT: You MUST answer ENTIRELY in ${targetLang}. Keep your response concise, bulleted, and actionable for field application.`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nFarmer Question: ${query}` }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }

    // Secondary Fallback: Groq Cloud API
    if (!aiResponseText && groqApiKey) {
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: Deno.env.get("GROQ_MODEL") || "qwen/qwen3.8-27b",
          messages: [
            {
              role: "system",
              content: `You are NuKropAI Agronomist. Answer strictly in ${targetLang}. Concise, scientific dosage instructions.`,
            },
            { role: "user", content: query },
          ],

          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (groqResponse.ok) {
        const groqData = await groqResponse.json();
        aiResponseText = groqData?.choices?.[0]?.message?.content || "";
      }
    }

    if (!aiResponseText) {
      aiResponseText = "క్షమించండి, సర్వర్ కనెక్షన్ తాత్కాలికంగా అందుబాటులో లేదు. దయచేసి కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.";
    }

    return new Response(JSON.stringify({ response: aiResponseText, language: targetLang }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
