import type { User } from "@basket-bot/core";
import { createContext } from "react";

export interface AdminSessionContextValue {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    tryRefreshToken: () => Promise<boolean>;
}

export const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(undefined);
