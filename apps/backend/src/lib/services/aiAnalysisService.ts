import OpenAI from "openai";
import type { Game, RequirementElement, CardAnalysisSuggestion, CardAnalysisResult } from "@chance/core";
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
    const drinking = DRINKING_LEVELS.levels
        .map((l) => `  ${l.value} = ${l.label}: ${l.cardDescription}`)
        .join("\n");
    const spice = SPICE_LEVELS.levels
        .map((l) => `  ${l.value} = ${l.label}: ${l.cardDescription}`)
        .join("\n");
    return `Drinking level (0–3):\n${drinking}\n\nSpice level (0–3):\n${spice}`;
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
  "requirementElementIds": [<string>, ...]
}

Rules:
- Use only IDs from the provided lists for gameTagIds and requirementElementIds.
- If the card doesn't fit any available game, return an empty array for gameTagIds.
- If the card requires no special props or player conditions, return an empty array for requirementElementIds.
- Be conservative with spice and drinking levels — only escalate if the content clearly warrants it.
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
        ? (obj.gameTagIds as unknown[])
              .filter((id): id is string => typeof id === "string" && availableGameIds.has(id))
        : [];

    const requirementElementIds = Array.isArray(obj.requirementElementIds)
        ? (obj.requirementElementIds as unknown[])
              .filter(
                  (id): id is string =>
                      typeof id === "string" && availableElementIds.has(id)
              )
        : [];

    return { spiceLevel, drinkingLevel, gameTagIds, requirementElementIds };
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

        return {
            cardId: card.cardId,
            title: card.title,
            current,
            suggested,
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
