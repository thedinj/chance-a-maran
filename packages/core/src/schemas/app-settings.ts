import { z } from "zod";
import { MAX_SETTING_KEY_LENGTH, MAX_SETTING_VALUE_LENGTH } from "../constants/index.js";
import { maxLengthString } from "./zodHelpers.js";

// ========== AppSetting ==========
export const appSettingSchema = z.object({
    key: maxLengthString(MAX_SETTING_KEY_LENGTH, "Setting key"),
    value: maxLengthString(MAX_SETTING_VALUE_LENGTH, "Setting value"),
    updatedAt: z.string().datetime(),
});

export type AppSetting = z.infer<typeof appSettingSchema>;
