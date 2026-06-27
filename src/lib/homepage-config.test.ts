import {
  defaultHomePageConfig,
  normalizeHomePageConfig,
} from './homepage-config';

describe('normalizeHomePageConfig', () => {
  it('keeps disabled module switches disabled', () => {
    expect(
      normalizeHomePageConfig({
        showHeroBanner: false,
        showContinueWatching: false,
        showUpcomingReleases: false,
        showHotMovies: false,
        showHotTvShows: false,
        showNewAnime: false,
        showHotVariety: false,
        showHotShortDramas: false,
      }),
    ).toEqual({
      showHeroBanner: false,
      showContinueWatching: false,
      showUpcomingReleases: false,
      showHotMovies: false,
      showHotTvShows: false,
      showNewAnime: false,
      showHotVariety: false,
      showHotShortDramas: false,
    });
  });

  it('fills only missing keys from defaults', () => {
    expect(
      normalizeHomePageConfig({
        showHeroBanner: false,
        showHotMovies: false,
      }),
    ).toEqual({
      ...defaultHomePageConfig,
      showHeroBanner: false,
      showHotMovies: false,
    });
  });
});
