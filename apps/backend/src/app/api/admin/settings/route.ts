import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import { getAppSetting, setAppSetting } from "@/lib/repos/referenceRepo";

export const dynamic = "force-dynamic";

function maskApiKey(key: string): string {
    if (key.length <= 7) return "****";
    return `${key.slice(0, 4)}...****`;
}

function buildSettingsResponse() {
    const inviteCodeSetting = getAppSetting("REGISTRATION_INVITATION_CODE");
    const openaiKeySetting = getAppSetting("OPENAI_API_KEY");
    const openaiModelSetting = getAppSetting("OPENAI_MODEL");

    const openaiKeyValue = openaiKeySetting?.value ?? "";
    const openaiKeySet = openaiKeyValue.length > 0;

    return {
        inviteCodeRequired: inviteCodeSetting?.value === "true",
        openaiKeySet,
        openaiKeyPreview: openaiKeySet ? maskApiKey(openaiKeyValue) : null,
        openaiModel: openaiModelSetting?.value ?? "gpt-4o-mini",
    };
}

export const GET = withAdmin(async () => {
    try {
        return ok(buildSettingsResponse());
    } catch (err) {
        return handleError(err);
    }
});

export const PATCH = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const { inviteCodeRequired, openaiApiKey, openaiModel } = body as {
            inviteCodeRequired?: boolean;
            openaiApiKey?: string;
            openaiModel?: string;
        };

        if (inviteCodeRequired !== undefined) {
            setAppSetting("REGISTRATION_INVITATION_CODE", String(inviteCodeRequired));
        }
        if (openaiApiKey !== undefined && openaiApiKey.trim().length > 0) {
            setAppSetting("OPENAI_API_KEY", openaiApiKey.trim());
        }
        if (openaiModel !== undefined) {
            setAppSetting("OPENAI_MODEL", openaiModel);
        }

        return ok(buildSettingsResponse());
    } catch (err) {
        return handleError(err);
    }
});
