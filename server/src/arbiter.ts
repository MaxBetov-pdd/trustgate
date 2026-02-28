import { OPENROUTER_API_KEY } from "./config";

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
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "arcee-ai/trinity-large-preview:free",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.statusText}`);
        }

        const data = await response.json();
        let outputText = data.choices[0].message.content;

        // Strip markdown backticks if present
        if (outputText.startsWith("\`\`\`json")) {
            outputText = outputText.slice(7, -3);
        } else if (outputText.startsWith("\`\`\`")) {
            outputText = outputText.slice(3, -3);
        }

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
