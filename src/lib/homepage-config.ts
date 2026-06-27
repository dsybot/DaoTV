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

export function normalizeHomePageConfig(
  config?: Partial<HomePageModuleConfig> | null,
): HomePageModuleConfig {
  return {
    showHeroBanner:
      config?.showHeroBanner ?? defaultHomePageConfig.showHeroBanner,
    showContinueWatching:
      config?.showContinueWatching ??
      defaultHomePageConfig.showContinueWatching,
    showUpcomingReleases:
      config?.showUpcomingReleases ??
      defaultHomePageConfig.showUpcomingReleases,
    showHotMovies: config?.showHotMovies ?? defaultHomePageConfig.showHotMovies,
    showHotTvShows:
      config?.showHotTvShows ?? defaultHomePageConfig.showHotTvShows,
    showNewAnime: config?.showNewAnime ?? defaultHomePageConfig.showNewAnime,
    showHotVariety:
      config?.showHotVariety ?? defaultHomePageConfig.showHotVariety,
    showHotShortDramas:
      config?.showHotShortDramas ?? defaultHomePageConfig.showHotShortDramas,
  };
}
