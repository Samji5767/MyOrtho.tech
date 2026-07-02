/**
 * Bootstrap DI verification: confirms AuthGuard, AuthService, and PermissionsGuard
 * are resolvable when AuthModule is imported, without any external services running.
 *
 * This test catches the class of runtime error:
 *   "Nest can't resolve dependencies of the AuthGuard (?). Please make sure that the
 *    argument AuthService at index [0] is available in the <X>Module context."
 * which occurs when a module uses @UseGuards(AuthGuard) but does not import AuthModule.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { PG_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';

const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
};

describe('AuthModule DI bootstrap', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // AuthModule imports AuditModule which imports DatabaseModule (PG_POOL).
    // We override both global tokens here so the test doesn't need a real
    // database or Redis connection.
    moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .overrideProvider(REDIS_CLIENT)
      .useValue(null)
      .compile();
  }, 15_000);

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  it('AuthService is resolvable', () => {
    expect(moduleRef.get(AuthService)).toBeDefined();
  });

  it('AuthGuard is resolvable (requires AuthService)', () => {
    expect(moduleRef.get(AuthGuard)).toBeDefined();
  });

  it('PermissionsGuard is resolvable (requires Reflector)', () => {
    expect(moduleRef.get(PermissionsGuard)).toBeDefined();
  });

  it('AuthModule exports match: AuthService, AuthGuard, PermissionsGuard', () => {
    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(AuthGuard)).toBeInstanceOf(AuthGuard);
    expect(moduleRef.get(PermissionsGuard)).toBeInstanceOf(PermissionsGuard);
  });
});
