export type HomePageModuleConfig = {
  showHeroBanner: boolean;
  showContinueWatching: boolean;
  showUpcomingReleases: boolean;
  showHotMovies: boolean;
  showHotTvShows: boolean;
  showNewAnime: boolean;
  showHotVariety: boolean;
  showHotShortDramas: boolean;
};

export const defaultHomePageConfig: HomePageModuleConfig = {
  showHeroBanner: true,
  showContinueWatching: true,
  showUpcomingReleases: true,
  showHotMovies: true,
  showHotTvShows: true,
  showNewAnime: true,
  showHotVariety: true,
  showHotShortDramas: true,
};
