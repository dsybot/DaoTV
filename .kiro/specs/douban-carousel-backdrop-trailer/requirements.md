# Requirements Document

## Introduction

本功能旨在改进首页轮播图组件，使其背景海报和预告片数据都从豆瓣获取，而不是依赖TMDB。这将提供更符合中文用户习惯的内容展示，并支持预告片播放功能。

## Glossary

- **Carousel**: 首页轮播图组件，展示热门影视内容
- **Backdrop**: 背景海报图片，用于轮播图的大背景展示
- **Trailer**: 预告片视频，用于在轮播图中播放影视预告
- **Douban_API**: 豆瓣数据接口，提供影视详情、海报、预告片等数据
- **HomeCarousel**: 首页轮播图React组件
- **Carousel_Generator**: 轮播图数据生成器，负责获取和处理轮播数据

## Requirements

### Requirement 1: 从豆瓣获取背景海报

**User Story:** As a user, I want to see high-quality backdrop images from Douban in the carousel, so that I can have a better visual experience with Chinese movie posters.

#### Acceptance Criteria

1. WHEN the carousel loads, THE Carousel_Generator SHALL fetch backdrop images from Douban API instead of TMDB
2. WHEN Douban provides a backdrop image, THE Carousel SHALL display the Douban backdrop as the background
3. IF Douban backdrop is unavailable, THEN THE Carousel SHALL fallback to using the poster image
4. WHEN displaying Douban images, THE System SHALL proxy the images through the image-proxy API to avoid CORS issues

### Requirement 2: 从豆瓣获取预告片

**User Story:** As a user, I want to watch movie trailers from Douban in the carousel, so that I can preview the content before watching.

#### Acceptance Criteria

1. WHEN fetching carousel data, THE Carousel_Generator SHALL retrieve trailer URLs from Douban details API
2. WHEN a trailer URL is available, THE HomeCarousel SHALL display a play button overlay
3. WHEN the user hovers or focuses on a carousel item with trailer, THE HomeCarousel SHALL auto-play the trailer after a delay
4. WHEN playing a trailer, THE HomeCarousel SHALL display the video with mute controls
5. IF the trailer URL is unavailable, THEN THE HomeCarousel SHALL display only the backdrop image without video controls

### Requirement 3: 预告片视频代理

**User Story:** As a developer, I want trailer videos to be proxied through our server, so that CORS restrictions are bypassed and videos play correctly.

#### Acceptance Criteria

1. WHEN a Douban trailer URL is detected, THE System SHALL route it through a video-proxy API endpoint
2. THE Video_Proxy SHALL handle Douban video URLs and return the video stream with proper headers
3. IF the video proxy fails, THEN THE System SHALL gracefully hide the video player and show the backdrop

### Requirement 4: 轮播图UI展示预告片

**User Story:** As a user, I want the carousel to display trailers in an elegant way, so that I can enjoy the preview experience.

#### Acceptance Criteria

1. WHEN a carousel item has a trailer, THE HomeCarousel SHALL show a mute/unmute toggle button
2. WHEN the trailer is playing, THE HomeCarousel SHALL display the video behind the content overlay
3. WHEN switching carousel items, THE HomeCarousel SHALL stop the previous trailer and prepare the next one
4. THE HomeCarousel SHALL auto-play trailers muted by default to avoid disturbing users
5. WHEN the user clicks unmute, THE HomeCarousel SHALL play the trailer with sound

### Requirement 5: 豆瓣详情API扩展

**User Story:** As a developer, I want the Douban details API to return backdrop and trailer data, so that the carousel can use this information.

#### Acceptance Criteria

1. THE Douban_Details_API SHALL parse and return the backdrop image URL from Douban pages
2. THE Douban_Details_API SHALL parse and return the trailer video URL from Douban pages
3. WHEN parsing Douban pages, THE System SHALL extract high-resolution backdrop images when available
4. THE Douban_Client type definitions SHALL include backdrop and trailerUrl fields
