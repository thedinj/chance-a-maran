import { ok } from "@/lib/auth/response";
import { getAppSetting } from "@/lib/repos/referenceRepo";

export const dynamic = "force-dynamic";

export function GET() {
    const setting = getAppSetting("REGISTRATION_INVITATION_CODE");
    const inviteCodeRequired = !!setting?.value;
    return ok({ inviteCodeRequired });
}
