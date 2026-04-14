import { NextResponse } from "next/server";
import {
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    InternalError,
    InvitationCodeError,
    NotFoundError,
    ValidationError,
} from "@chance/core";

export function errorToStatus(error: AppError): number {
    if (error instanceof AuthenticationError) return 401;
    if (error instanceof AuthorizationError) return 403;
    if (error instanceof NotFoundError) return 404;
    if (error instanceof ConflictError) return 409;
    if (error instanceof ValidationError || error instanceof InvitationCodeError) return 400;
    return 500;
}

export function ok<T>(data: T, status = 200): NextResponse {
    return NextResponse.json(
        { ok: true, data, serverTimestamp: new Date().toISOString() },
        { status }
    );
}

/** Catches AppErrors cleanly; logs and wraps anything else as 500. */
export function handleError(err: unknown): NextResponse {
    if (err instanceof AppError) return fail(err);
    // eslint-disable-next-line no-console
    console.error("[API error]", err);
    return fail(new InternalError());
}

export function fail(error: AppError): NextResponse {
    return NextResponse.json(
        {
            ok: false,
            error: {
                code: error.code,
                message: error.message,
                ...(error.details !== undefined ? { details: error.details } : {}),
            },
            serverTimestamp: new Date().toISOString(),
        },
        { status: errorToStatus(error) }
    );
}
