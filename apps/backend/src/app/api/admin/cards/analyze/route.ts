import { z } from "zod";
import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardRepo from "@/lib/repos/cardRepo";
import * as gameRepo from "@/lib/repos/gameRepo";
import * as requirementElementRepo from "@/lib/repos/requirementElementRepo";
import { getAppSetting } from "@/lib/repos/referenceRepo";
import { analyzeCards, type CardAnalysisInput } from "@/lib/services/aiAnalysisService";
import { ValidationError, NotFoundError } from "@chance/core";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
    cardIds: z.array(z.string().uuid()).min(1).max(100),
});

export const POST = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError("Invalid request body", parsed.error.flatten());
        }

        const apiKeySetting = getAppSetting("OPENAI_API_KEY");
        const apiKey = apiKeySetting?.value ?? "";
        if (!apiKey) {
            throw new ValidationError("OpenAI API key is not configured. Add it in Settings.");
        }

        const modelSetting = getAppSetting("OPENAI_MODEL");
        const model = modelSetting?.value ?? "gpt-4o-mini";

        const inputs: CardAnalysisInput[] = [];
        const missingIds: string[] = [];
        for (const cardId of parsed.data.cardIds) {
            const card = cardRepo.findById(cardId);
            if (!card) {
                missingIds.push(cardId);
                continue;
            }
            const cv = card.currentVersion;
            inputs.push({
                cardId: card.id,
                title: cv.title,
                description: cv.description,
                hiddenInstructions: cv.hiddenInstructions ?? null,
                currentSpiceLevel: cv.spiceLevel,
                currentDrinkingLevel: cv.drinkingLevel,
                currentGameTagIds: cv.gameTags.map((g) => g.id),
                currentRequirementElementIds: cv.requirements.map((r) => r.id),
            });
        }

        if (missingIds.length > 0) {
            throw new NotFoundError(`Cards not found: ${missingIds.join(", ")}`);
        }

        const games = gameRepo.findAll();
        const elements = requirementElementRepo.listActive();

        const results = await analyzeCards(inputs, games, elements, apiKey, model);

        return ok({ results });
    } catch (err) {
        return handleError(err);
    }
});
