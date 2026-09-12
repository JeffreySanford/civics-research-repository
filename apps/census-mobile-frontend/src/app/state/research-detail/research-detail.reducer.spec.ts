import { MobileResearchDetailActions } from './research-detail.actions';
import {
  initialMobileResearchDetailState,
  mobileResearchDetailReducer,
} from './research-detail.reducer';

describe('mobileResearchDetailReducer', () => {
  it('starts a detail request without retaining a previous object', () => {
    const state = mobileResearchDetailReducer(
      { ...initialMobileResearchDetailState, detail: {} as never },
      MobileResearchDetailActions.detailOpened({ researchId: 'token' }),
    );

    expect(state.researchId).toBe('token');
    expect(state.loading).toBe(true);
    expect(state.detail).toBeNull();
    expect(state.error).toBeNull();
  });

  it('surfaces a failed detail request', () => {
    const state = mobileResearchDetailReducer(
      initialMobileResearchDetailState,
      MobileResearchDetailActions.detailFailed({ message: 'Not found' }),
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe('Not found');
  });
});
