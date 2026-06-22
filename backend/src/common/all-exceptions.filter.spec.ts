import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost(method = 'GET', url = '/test') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method, url }),
    }),
  };
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('maps an HttpException to its status and message', () => {
    const { host, status, json } = mockHost('POST', '/cases');
    filter.catch(new HttpException('Forbidden resource', HttpStatus.FORBIDDEN), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden resource',
        path: '/cases',
      }),
    );
  });

  it('maps an unknown error to 500 without leaking internals', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('db password = hunter2'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = json.mock.calls[0][0];
    expect(payload.statusCode).toBe(500);
    expect(payload.message).toBe('Internal server error');
    expect(JSON.stringify(payload)).not.toContain('hunter2');
  });

  it('includes a timestamp and request path', () => {
    const { host, json } = mockHost('DELETE', '/billing/42');
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    const payload = json.mock.calls[0][0];
    expect(payload.path).toBe('/billing/42');
    expect(payload.timestamp).toBeDefined();
  });
});
