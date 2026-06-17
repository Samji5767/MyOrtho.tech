import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key || url.includes('placeholder') || key === 'placeholder') {
      throw new UnauthorizedException('Backend Supabase credentials are not configured.');
    }

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authHeader.split(' ')[1];
    
    // Validate JWT using Supabase auth manager
    const { data: { user }, error } = await this.supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new UnauthorizedException('Invalid JWT session credentials');
    }

    // Attach user profile metadata for route multi-tenant check
    request.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'dentist',
      organizationId: user.user_metadata?.organizationId,
    };

    return true;
  }
}
