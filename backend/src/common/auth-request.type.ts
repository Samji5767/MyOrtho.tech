import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
    orgId: string | null;
    jti: string;
  };
}
