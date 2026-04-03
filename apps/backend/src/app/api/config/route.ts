import { ok } from "@/lib/auth/response";
import { getAppSetting } from "@/lib/repos/referenceRepo";

export const dynamic = "force-dynamic";

export function GET() {
    const setting = getAppSetting("REGISTRATION_INVITATION_CODE");
    // Registration is enabled if the setting exists and has a non-empty value
    const registrationEnabled = !!setting?.value;
    return ok({ registrationEnabled });
}
