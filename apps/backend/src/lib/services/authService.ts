import { compare, hash } from "bcryptjs";
import { randomUUID } from "crypto";
import {
    AuthenticationError,
    ConflictError,
    InvitationCodeError,
    NotFoundError,
} from "@chance/core";
import type { LoginRequest, RegisterRequest, User } from "@chance/core";
import {
    generateAccessToken,
    generateRawRefreshToken,
    getRefreshTokenExpiry,
    hashRefreshToken,
} from "../auth/jwt";
import type { JwtPayload } from "../auth/types";
import * as invitationCodeRepo from "../repos/invitationCodeRepo";
import * as refreshTokenRepo from "../repos/refreshTokenRepo";
import * as userRepo from "../repos/userRepo";
import * as playerRepo from "../repos/playerRepo";
import { db } from "../db/db";

const BCRYPT_ROUNDS = 12;

function issueTokenPair(user: userRepo.DbUser): { accessToken: string; rawRefreshToken: string } {
    const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        scopes: user.is_admin ? ["admin"] : [],
    });

    const rawRefreshToken = generateRawRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);

    refreshTokenRepo.create({
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt: getRefreshTokenExpiry(),
    });

    return { accessToken, rawRefreshToken };
}

export async function register(
    req: RegisterRequest
): Promise<{ user: User; accessToken: string; rawRefreshToken: string }> {
    // Validate invitation code
    const code = invitationCodeRepo.findByCode(req.invitationCode);
    if (!code) throw new InvitationCodeError("Invitation code not found");
    if (!code.is_active) throw new InvitationCodeError("Invitation code has been deactivated");
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
        throw new InvitationCodeError("Invitation code has expired");
    }

    // Check email uniqueness
    if (userRepo.findByEmail(req.email)) {
        throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hash(req.password, BCRYPT_ROUNDS);
    const userId = randomUUID();

    userRepo.create({
        id: userId,
        email: req.email,
        displayName: req.displayName,
        passwordHash,
        invitationCodeId: code.id,
    });

    const user = userRepo.findById(userId)!;
    const tokens = issueTokenPair(user);
    return { user: userRepo.mapUser(user), ...tokens };
}

export async function login(
    req: LoginRequest
): Promise<{ user: User; accessToken: string; rawRefreshToken: string }> {
    const user = userRepo.findByEmail(req.email);
    if (!user) throw new AuthenticationError("Invalid email or password");

    const valid = await compare(req.password, user.password_hash);
    if (!valid) throw new AuthenticationError("Invalid email or password");

    const tokens = issueTokenPair(user);
    return { user: userRepo.mapUser(user), ...tokens };
}

export function refresh(
    rawRefreshToken: string
): { accessToken: string; rawRefreshToken: string } {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const stored = refreshTokenRepo.findByHash(tokenHash);

    if (!stored) throw new AuthenticationError("Invalid refresh token");
    if (stored.revoked) throw new AuthenticationError("Refresh token has been revoked");
    if (new Date(stored.expires_at) < new Date()) {
        throw new AuthenticationError("Refresh token has expired");
    }

    const user = userRepo.findById(stored.user_id);
    if (!user) throw new NotFoundError("User not found");

    // Rotate: revoke old, issue new pair
    refreshTokenRepo.revokeByHash(tokenHash);
    return issueTokenPair(user);
}

export function logout(rawRefreshToken: string): void {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    refreshTokenRepo.revokeByHash(tokenHash); // silent fail if not found
}

export async function claimAccount(
    guestPayload: JwtPayload,
    credentials: LoginRequest | RegisterRequest
): Promise<{ user: User; accessToken: string; rawRefreshToken: string }> {
    if (guestPayload.type !== "guest" || !guestPayload.sessionId) {
        throw new AuthenticationError("Claim requires a valid guest JWT");
    }

    // Resolve or create the registered user
    let registeredUser: userRepo.DbUser;

    if ("invitationCode" in credentials) {
        // Registration path
        const result = await register(credentials as RegisterRequest);
        registeredUser = userRepo.findByEmail((credentials as RegisterRequest).email)!;
        // Already issued tokens from register(), but we'll issue new ones below
    } else {
        // Login path
        const loginReq = credentials as LoginRequest;
        const user = userRepo.findByEmail(loginReq.email);
        if (!user) throw new AuthenticationError("Invalid email or password");
        const valid = await compare(loginReq.password, user.password_hash);
        if (!valid) throw new AuthenticationError("Invalid email or password");
        registeredUser = user;
    }

    // Check if this registered user is already in the session
    const existing = playerRepo.findBySessionAndUserId(guestPayload.sessionId, registeredUser.id);
    if (existing) {
        throw new ConflictError("This account is already in the session");
    }

    // Atomically promote the guest player record
    db.transaction(() => {
        playerRepo.setUserId(guestPayload.sub, registeredUser.id);
    })();

    const tokens = issueTokenPair(registeredUser);
    return { user: userRepo.mapUser(registeredUser), ...tokens };
}

export function getMe(userId: string): User {
    const user = userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    return userRepo.mapUser(user);
}
