import { z } from "zod";
import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardRepo from "@/lib/repos/cardRepo";
import * as gameRepo from "@/lib/repos/gameRepo";
import * as requirementElementRepo from "@/lib/repos/requirementElementRepo";
import { getAppSetting } from "@/lib/repos/referenceRepo";
import { analyzeCard, type CardAnalysisInput } from "@/lib/services/aiAnalysisService";
import { ValidationError, NotFoundError } from "@chance/core";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
    cardId: z.string().uuid(),
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

        const card = cardRepo.findById(parsed.data.cardId);
        if (!card) {
            throw new NotFoundError("Card not found");
        }

        const cv = card.currentVersion;
        const input: CardAnalysisInput = {
            cardId: card.id,
            title: cv.title,
            description: cv.description,
            hiddenInstructions: cv.hiddenInstructions ?? null,
            currentSpiceLevel: cv.spiceLevel,
            currentDrinkingLevel: cv.drinkingLevel,
            currentGameTagIds: cv.gameTags.map((g) => g.id),
            currentRequirementElementIds: cv.requirements.map((r) => r.id),
        };

        const games = gameRepo.findAll();
        const elements = requirementElementRepo.listActive();

        const result = await analyzeCard(input, games, elements, apiKey, model);

        return ok(result);
    } catch (err) {
        return handleError(err);
    }
});
