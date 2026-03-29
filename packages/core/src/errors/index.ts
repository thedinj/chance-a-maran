export { ErrorCode, ErrorCodeSchema } from "./codes";
export type { ErrorCode as ErrorCodeType } from "./codes";

import { ErrorCode } from "./codes";

// ErrorCode is imported as both a value (ErrorCode.NOT_FOUND_ERROR) and a type
// (the string union) — TypeScript resolves the dual export from codes.ts automatically.

export class AppError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export class AuthenticationError extends AppError {
    constructor(message = "Authentication required", details?: unknown) {
        super(ErrorCode.AUTHENTICATION_ERROR, message, details);
        this.name = "AuthenticationError";
    }
}

export class AuthorizationError extends AppError {
    constructor(message = "Insufficient permissions", details?: unknown) {
        super(ErrorCode.AUTHORIZATION_ERROR, message, details);
        this.name = "AuthorizationError";
    }
}

export class ValidationError extends AppError {
    constructor(message = "Validation failed", details?: unknown) {
        super(ErrorCode.VALIDATION_ERROR, message, details);
        this.name = "ValidationError";
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found", details?: unknown) {
        super(ErrorCode.NOT_FOUND_ERROR, message, details);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends AppError {
    constructor(message = "Resource conflict", details?: unknown) {
        super(ErrorCode.CONFLICT_ERROR, message, details);
        this.name = "ConflictError";
    }
}

export class InvitationCodeError extends AppError {
    constructor(message = "Invalid or expired invitation code", details?: unknown) {
        super(ErrorCode.INVITATION_CODE_ERROR, message, details);
        this.name = "InvitationCodeError";
    }
}

export class InternalError extends AppError {
    constructor(message = "Internal server error", details?: unknown) {
        super(ErrorCode.INTERNAL_ERROR, message, details);
        this.name = "InternalError";
    }
}
