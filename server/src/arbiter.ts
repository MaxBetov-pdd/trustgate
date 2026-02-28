import { GEMINI_API_KEY } from "./config";

export async function evaluateResult(task: string, criteria: string, result: string) {
    const prompt = `You are an AI Arbiter for a service marketplace. Evaluate the delivery.
Task: ${task}
Quality Criteria: ${criteria}

Delivered Result:
${result}

Evaluate the result and output JSON with:
- score: 0 to 100 based on quality and matching criteria
- verdict: "approve" (score >= 50) or "reject" (score < 50). The work is either done or not done, there is no middle ground.
- reason: brief explanation

Respond strictly with JSON object.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        const outputText = data.candidates[0].content.parts[0].text;
        const output = JSON.parse(outputText || "{}");

        return {
            score: output.score || 0,
            verdict: output.verdict || "reject",
            reason: output.reason || "Failed to parse",
            percentToSeller: output.percentToSeller || 0
        };
    } catch (error) {
        console.error("Arbiter error:", error);
        return { score: 0, verdict: "reject", reason: "Error contacting LLM", percentToSeller: 0 };
    }
}
