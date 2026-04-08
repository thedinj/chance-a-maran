import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import { getAppSetting, setAppSetting } from "@/lib/repos/referenceRepo";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
    try {
        const setting = getAppSetting("REGISTRATION_INVITATION_CODE");
        return ok({ inviteCodeRequired: setting?.value === "true" });
    } catch (err) {
        return handleError(err);
    }
});

export const PATCH = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const { inviteCodeRequired } = body as { inviteCodeRequired?: boolean };
        if (inviteCodeRequired !== undefined) {
            setAppSetting("REGISTRATION_INVITATION_CODE", String(inviteCodeRequired));
        }
        const setting = getAppSetting("REGISTRATION_INVITATION_CODE");
        return ok({ inviteCodeRequired: setting?.value === "true" });
    } catch (err) {
        return handleError(err);
    }
});
