import OpenAI from "openai";
import type {
    Game,
    RequirementElement,
    CardAnalysisSuggestion,
    CardAnalysisResult,
} from "@chance/core";
import { DRINKING_LEVELS, SPICE_LEVELS } from "@chance/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardAnalysisInput {
    cardId: string;
    title: string;
    description: string;
    hiddenInstructions: string | null;
    currentSpiceLevel: number;
    currentDrinkingLevel: number;
    currentGameTagIds: string[];
    currentRequirementElementIds: string[];
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function buildLevelDescriptions(): string {
    const drinking = [...DRINKING_LEVELS.levels]
        .sort((a, b) => b.value - a.value)
        .map((l) => `  ${l.value} = ${l.label}: ${l.llmDescription}`)
        .join("\n");
    const spice = [...SPICE_LEVELS.levels]
        .sort((a, b) => b.value - a.value)
        .map((l) => `  ${l.value} = ${l.label}: ${l.llmDescription}`)
        .join("\n");
    return `Classification method (required): evaluate levels from 3 down to 0 and choose the FIRST level that cannot be confidently ruled out by the card text. Only move down when you can clearly prove the higher level does not apply.\n\nDrinking level rubric (check 3→0):\n${drinking}\n\nSpice level rubric (check 3→0):\n${spice}`;
}

function buildGameList(games: Game[]): string {
    if (games.length === 0) return "  (none available)";
    return games.map((g) => `  ${g.id} = "${g.name}"`).join("\n");
}

function buildElementList(elements: RequirementElement[]): string {
    if (elements.length === 0) return "  (none available)";
    return elements.map((e) => `  ${e.id} = "${e.title}"`).join("\n");
}

function buildSystemPrompt(games: Game[], elements: RequirementElement[]): string {
    return `You are a content categorizer for "Chance", a social party card game app.

Your job is to analyze a party game card and return categorization recommendations.

${buildLevelDescriptions()}

Available game tags (use exact IDs — only choose from this list, or return an empty array):
${buildGameList(games)}

Available requirement elements (physical props or player requirements — use exact IDs, or return an empty array):
${buildElementList(elements)}

Respond ONLY with a valid JSON object in this exact shape:
{
  "spiceLevel": <integer 0–3>,
  "drinkingLevel": <integer 0–3>,
  "gameTagIds": [<string>, ...],
  "requirementElementIds": [<string>, ...],
  "justification": <string>
}

Rules:
- Use only IDs from the provided lists for gameTagIds and requirementElementIds.
- If the card doesn't fit any available game, return an empty array for gameTagIds.
- If the card requires no special props or player conditions, return an empty array for requirementElementIds.
- Read ALL provided text fields (title, description, hidden instructions) before rating.
- You MUST apply each level scale from 3 down to 0. Pick the first level that cannot be ruled out.
- Conservative downgrade rule: do not choose a lower level unless the card text clearly disproves the higher level.
- Profanity/innuendo rule: if any swear word, profanity, or sexually suggestive/innuendo language appears in any field (especially the title), spiceLevel MUST be at LEAST 1 (never 0/Clean). Level 0 is strictly family-friendly content. If your own justification acknowledges innuendo or suggestive language, spiceLevel CANNOT be 0.
- Orthogonality rule: drinkingLevel and spiceLevel are completely independent. Drinking content (alcohol, shots, sips, drinking consequences) has NO effect on spiceLevel. A card about drinking is not automatically adult, suggestive, or crude — it may be spice 0. Only sexual language, profanity, crude references, or racial content raise spiceLevel. Never let the presence of alcohol or a high drinkingLevel push spiceLevel above what the sexual/language content alone would warrant.
- Strong profanity, slurs, or aggressively vulgar language should usually be spiceLevel 3 or 2.
- Any racial content, even innuendo, is automatically spiceLevel 3.
- justification must be short, plain-language, and reference the card content that drove your choices.
- Do not include any text outside the JSON object.`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAndClamp(
    raw: unknown,
    availableGameIds: Set<string>,
    availableElementIds: Set<string>
): CardAnalysisSuggestion {
    const obj = raw as Record<string, unknown>;

    const spiceLevel = Math.max(0, Math.min(3, Math.round(Number(obj.spiceLevel) || 0)));
    const drinkingLevel = Math.max(0, Math.min(3, Math.round(Number(obj.drinkingLevel) || 0)));

    const gameTagIds = Array.isArray(obj.gameTagIds)
        ? (obj.gameTagIds as unknown[]).filter(
              (id): id is string => typeof id === "string" && availableGameIds.has(id)
          )
        : [];

    const requirementElementIds = Array.isArray(obj.requirementElementIds)
        ? (obj.requirementElementIds as unknown[]).filter(
              (id): id is string => typeof id === "string" && availableElementIds.has(id)
          )
        : [];

    return { spiceLevel, drinkingLevel, gameTagIds, requirementElementIds };
}

function extractJustification(raw: unknown): string {
    const obj = raw as Record<string, unknown>;
    const justification = typeof obj.justification === "string" ? obj.justification.trim() : "";
    return justification || "No justification provided by the model.";
}

function hasDiff(current: CardAnalysisSuggestion, suggested: CardAnalysisSuggestion): boolean {
    if (current.spiceLevel !== suggested.spiceLevel) return true;
    if (current.drinkingLevel !== suggested.drinkingLevel) return true;
    const sortedCurrentGames = [...current.gameTagIds].sort().join(",");
    const sortedSuggestedGames = [...suggested.gameTagIds].sort().join(",");
    if (sortedCurrentGames !== sortedSuggestedGames) return true;
    const sortedCurrentEls = [...current.requirementElementIds].sort().join(",");
    const sortedSuggestedEls = [...suggested.requirementElementIds].sort().join(",");
    if (sortedCurrentEls !== sortedSuggestedEls) return true;
    return false;
}

// ─── Internal single-card helper ─────────────────────────────────────────────

async function _analyzeOne(
    card: CardAnalysisInput,
    gameLookup: Record<string, string>,
    elementLookup: Record<string, string>,
    availableGameIds: Set<string>,
    availableElementIds: Set<string>,
    systemPrompt: string,
    apiKey: string,
    model: string
): Promise<CardAnalysisResult> {
    const current: CardAnalysisSuggestion = {
        spiceLevel: card.currentSpiceLevel,
        drinkingLevel: card.currentDrinkingLevel,
        gameTagIds: card.currentGameTagIds,
        requirementElementIds: card.currentRequirementElementIds,
    };

    try {
        const client = new OpenAI({ apiKey });

        const userMessage = [
            `Title: ${card.title}`,
            `Description: ${card.description}`,
            `Hidden instructions: ${card.hiddenInstructions ?? "none"}`,
        ].join("\n");

        const response = await client.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            temperature: 0.2,
        });

        const rawText = response.choices[0]?.message?.content ?? "{}";
        const parsed: unknown = JSON.parse(rawText);
        const suggested = validateAndClamp(parsed, availableGameIds, availableElementIds);
        const justification = extractJustification(parsed);

        return {
            cardId: card.cardId,
            title: card.title,
            current,
            suggested,
            justification,
            changed: hasDiff(current, suggested),
            gameLookup,
            elementLookup,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            cardId: card.cardId,
            title: card.title,
            current,
            suggested: current,
            justification: "AI analysis failed before a justification could be generated.",
            changed: false,
            error: message,
            gameLookup,
            elementLookup,
        };
    }
}

// ─── Public exports ───────────────────────────────────────────────────────────

/** Analyze multiple cards sequentially (one OpenAI request at a time). */
export async function analyzeCards(
    cards: CardAnalysisInput[],
    games: Game[],
    elements: RequirementElement[],
    apiKey: string,
    model: string
): Promise<CardAnalysisResult[]> {
    const gameLookup: Record<string, string> = Object.fromEntries(games.map((g) => [g.id, g.name]));
    const elementLookup: Record<string, string> = Object.fromEntries(
        elements.map((e) => [e.id, e.title])
    );
    const availableGameIds = new Set(games.map((g) => g.id));
    const availableElementIds = new Set(elements.map((e) => e.id));
    const systemPrompt = buildSystemPrompt(games, elements);

    const results: CardAnalysisResult[] = [];
    for (const card of cards) {
        results.push(
            await _analyzeOne(
                card,
                gameLookup,
                elementLookup,
                availableGameIds,
                availableElementIds,
                systemPrompt,
                apiKey,
                model
            )
        );
    }
    return results;
}

export async function analyzeCard(
    card: CardAnalysisInput,
    games: Game[],
    elements: RequirementElement[],
    apiKey: string,
    model: string
): Promise<CardAnalysisResult> {
    return (await analyzeCards([card], games, elements, apiKey, model))[0];
}
