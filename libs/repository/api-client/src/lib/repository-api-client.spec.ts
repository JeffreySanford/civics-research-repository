import { repositoryApiClient } from './repository-api-client';

describe('repositoryApiClient', () => {
  it('should work', () => {
    expect(repositoryApiClient()).toEqual('repository-api-client');
  });
});
