import type { User } from "@chance/core";
import { createContext } from "react";

export interface AdminSessionContextValue {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    tryRefreshToken: () => Promise<string | null>;
}

export const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(undefined);
