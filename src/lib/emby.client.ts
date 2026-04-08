/* eslint-disable no-console */

interface EmbyConfig {
  ServerURL: string;
  ApiKey?: string;
  Username?: string;
  Password?: string;
  UserId?: string;
  AuthToken?: string;
  ClientName?: string;
  DeviceName?: string;
  DeviceId?: string;
  ClientVersion?: string;
  // 高级流媒体选项
  removeEmbyPrefix?: boolean;
  appendMediaSourceId?: boolean;
  transcodeMp4?: boolean;
  proxyPlay?: boolean; // 视频播放代理开关
  key?: string; // Emby源的唯一标识
}

interface EmbyItem {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Season' | 'Episode';
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  PremiereDate?: string;
  ImageTags?: { Primary?: string };
  ParentIndexNumber?: number;
  IndexNumber?: number;
  MediaSources?: Array<{
    Id: string;
    MediaStreams?: Array<{
      Type: string;
      Index: number;
      DisplayTitle?: string;
      Language?: string;
      Codec?: string;
      IsExternal?: boolean;
      DeliveryUrl?: string;
      IsDefault?: boolean;
    }>;
  }>;
}

interface AudioStream {
  index: number;
  displayTitle?: string;
  language?: string;
  codec?: string;
  isDefault: boolean;
}

interface PlaybackInfoResponse {
  MediaSources?: Array<{
    MediaStreams?: Array<{
      Type?: string;
      Index?: number;
      DisplayTitle?: string;
      Language?: string;
      Codec?: string;
      IsDefault?: boolean;
    }>;
  }>;
  MediaStreams?: Array<{
    Type?: string;
    Index?: number;
    DisplayTitle?: string;
    Language?: string;
    Codec?: string;
    IsDefault?: boolean;
  }>;
}

interface EmbyItemsResult {
  Items: EmbyItem[];
  TotalRecordCount: number;
}

interface GetItemsParams {
  ParentId?: string;
  IncludeItemTypes?: string;
  Recursive?: boolean;
  Fields?: string;
  SortBy?: string;
  SortOrder?: string;
  StartIndex?: number;
  Limit?: number;
  searchTerm?: string;
}

interface EmbyView {
  Id: string;
  Name: string;
  CollectionType?: string;
}

const DEFAULT_CLIENT_NAME = 'Emby';
const DEFAULT_DEVICE_NAME = 'Windows';
const DEFAULT_DEVICE_ID = 'emby-windows';
const DEFAULT_CLIENT_VERSION = '1.0.0';

function normalizeIdentityValue(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export class EmbyClient {
  private serverUrl: string;
  private apiKey?: string;
  private userId?: string;
  private authToken?: string;
  private username?: string;
  private password?: string;
  private removeEmbyPrefix: boolean;
  private appendMediaSourceId: boolean;
  private transcodeMp4: boolean;
  private proxyPlay: boolean;
  private embyKey?: string;
  private clientName: string;
  private deviceName: string;
  private deviceId: string;
  private clientVersion: string;

  constructor(config: EmbyConfig) {
    let serverUrl = config.ServerURL.replace(/\/$/, '');

    // 🔍 调试日志
    console.log('🎬 EmbyClient 初始化配置:', {
      transcodeMp4: config.transcodeMp4,
      proxyPlay: config.proxyPlay,
      key: config.key,
    });

    // 存储高级选项
    this.removeEmbyPrefix = config.removeEmbyPrefix || false;
    this.appendMediaSourceId = config.appendMediaSourceId || false;
    this.transcodeMp4 = config.transcodeMp4 || false;
    this.proxyPlay = config.proxyPlay || false;
    this.embyKey = config.key;

    // 如果 URL 不包含 /emby 路径，自动添加（除非启用了 removeEmbyPrefix）
    if (!serverUrl.endsWith('/emby') && !this.removeEmbyPrefix) {
      serverUrl += '/emby';
    }

    // 如果启用了 removeEmbyPrefix 且 URL 包含 /emby，移除它
    if (this.removeEmbyPrefix && serverUrl.endsWith('/emby')) {
      serverUrl = serverUrl.slice(0, -5); // Remove '/emby'
    }

    this.serverUrl = serverUrl;
    this.apiKey = config.ApiKey;
    this.userId = config.UserId;
    this.authToken = config.AuthToken;
    this.username = config.Username;
    this.password = config.Password;
    this.clientName = normalizeIdentityValue(
      config.ClientName,
      DEFAULT_CLIENT_NAME,
    );
    this.deviceName = normalizeIdentityValue(
      config.DeviceName,
      DEFAULT_DEVICE_NAME,
    );
    this.deviceId = normalizeIdentityValue(config.DeviceId, DEFAULT_DEVICE_ID);
    this.clientVersion = normalizeIdentityValue(
      config.ClientVersion,
      DEFAULT_CLIENT_VERSION,
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    // 如果有 ApiKey 但没有 userId，需要获取用户 ID
    if (this.apiKey && !this.userId) {
      const user = await this.getCurrentUser();
      this.userId = user.Id;
      return;
    }

    // 如果有 ApiKey，不需要认证
    if (this.apiKey) return;

    // 如果有 AuthToken，假设它是有效的
    if (this.authToken) return;

    // 如果有用户名，自动认证（密码可选）
    if (this.username) {
      const authResult = await this.authenticate(
        this.username,
        this.password || '',
      );
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;
    }
  }

  private escapeIdentityValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private getAuthorizationHeaderValue(): string {
    return `MediaBrowser Client="${this.escapeIdentityValue(this.clientName)}", Device="${this.escapeIdentityValue(this.deviceName)}", DeviceId="${this.escapeIdentityValue(this.deviceId)}", Version="${this.escapeIdentityValue(this.clientVersion)}"`;
  }

  getRequestHeaders(
    headers: HeadersInit = {},
    includeContentType = false,
  ): Headers {
    const mergedHeaders = new Headers(headers);

    if (includeContentType && !mergedHeaders.has('Content-Type')) {
      mergedHeaders.set('Content-Type', 'application/json');
    }

    if (!mergedHeaders.has('X-Emby-Authorization')) {
      mergedHeaders.set(
        'X-Emby-Authorization',
        this.getAuthorizationHeaderValue(),
      );
    }

    if (!mergedHeaders.has('User-Agent')) {
      mergedHeaders.set(
        'User-Agent',
        `${this.clientName}/${this.clientVersion}`,
      );
    }

    if (this.apiKey && !mergedHeaders.has('X-Emby-Token')) {
      mergedHeaders.set('X-Emby-Token', this.apiKey);
    } else if (this.authToken && !mergedHeaders.has('X-Emby-Token')) {
      mergedHeaders.set('X-Emby-Token', this.authToken);
    }

    return mergedHeaders;
  }

  private async embyFetch(
    url: string,
    init: RequestInit = {},
    includeContentType = false,
  ): Promise<Response> {
    return fetch(url, {
      ...init,
      headers: this.getRequestHeaders(
        init.headers,
        includeContentType || init.body !== undefined,
      ),
    });
  }

  async authenticate(
    username: string,
    password: string,
  ): Promise<{ AccessToken: string; User: { Id: string } }> {
    const url = `${this.serverUrl}/Users/AuthenticateByName`;

    const response = await this.embyFetch(
      url,
      {
        method: 'POST',
        body: JSON.stringify({ Username: username, Pw: password }),
      },
      true,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Emby 认证失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    this.authToken = data.AccessToken;
    this.userId = data.User.Id;
    return data;
  }

  async getCurrentUser(): Promise<{ Id: string; Name: string }> {
    // 如果使用 API Key，通过 /Users 端点获取用户列表（用 query param 传 api_key）
    if (this.apiKey) {
      const url = `${this.serverUrl}/Users?api_key=${this.apiKey}`;
      const response = await this.embyFetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取用户列表失败 (${response.status}): ${errorText}`);
      }

      const users = await response.json();
      if (!users || users.length === 0) {
        throw new Error('未找到任何用户');
      }

      return users[0];
    }

    // 使用用户名密码时，先确保已认证
    if (this.username && this.password && !this.authToken) {
      const authResult = await this.authenticate(this.username, this.password);
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;
      return authResult.User as { Id: string; Name: string };
    }

    // 已有 authToken，用 userId 直接访问 /Users/{id}
    if (this.authToken && this.userId) {
      const url = `${this.serverUrl}/Users/${this.userId}?api_key=${this.authToken}`;
      const response = await this.embyFetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `获取当前用户信息失败 (${response.status}): ${errorText}`,
        );
      }
      return await response.json();
    }

    throw new Error('未提供认证信息');
  }

  async getUserViews(): Promise<EmbyView[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID，请在管理面板重新保存 Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Users/${this.userId}/Views${token ? `?api_key=${token}` : ''}`;

    const response = await this.embyFetch(url);

    // 如果是 401 错误且有用户名密码，尝试重新认证
    if (
      response.status === 401 &&
      this.username &&
      this.password &&
      !this.apiKey
    ) {
      const authResult = await this.authenticate(this.username, this.password);
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retryUrl = `${this.serverUrl}/Users/${this.userId}/Views?api_key=${this.authToken}`;
      const retryResponse = await this.embyFetch(retryUrl);

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(
          `获取 Emby 媒体库列表失败 (${retryResponse.status}): ${errorText}`,
        );
      }

      const retryData = await retryResponse.json();
      return retryData.Items || [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `获取 Emby 媒体库列表失败 (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    return data.Items || [];
  }

  async getItems(params: GetItemsParams): Promise<EmbyItemsResult> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID，请在管理面板重新保存 Emby 配置');
    }

    const searchParams = new URLSearchParams();

    if (params.ParentId) searchParams.set('ParentId', params.ParentId);
    if (params.IncludeItemTypes)
      searchParams.set('IncludeItemTypes', params.IncludeItemTypes);
    if (params.Recursive !== undefined)
      searchParams.set('Recursive', params.Recursive.toString());
    if (params.Fields) searchParams.set('Fields', params.Fields);
    if (params.SortBy) searchParams.set('SortBy', params.SortBy);
    if (params.SortOrder) searchParams.set('SortOrder', params.SortOrder);
    if (params.StartIndex !== undefined)
      searchParams.set('StartIndex', params.StartIndex.toString());
    if (params.Limit !== undefined)
      searchParams.set('Limit', params.Limit.toString());
    if (params.searchTerm) searchParams.set('searchTerm', params.searchTerm);

    // 添加认证参数
    const token = this.apiKey || this.authToken;
    if (token) {
      searchParams.set('X-Emby-Token', token);
    }

    const url = `${this.serverUrl}/Users/${this.userId}/Items?${searchParams.toString()}`;

    const response = await this.embyFetch(url);

    // 如果是 401 错误且有用户名密码，尝试重新认证
    if (
      response.status === 401 &&
      this.username &&
      this.password &&
      !this.apiKey
    ) {
      const authResult = await this.authenticate(this.username, this.password);
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      searchParams.set('X-Emby-Token', this.authToken);
      const retryUrl = `${this.serverUrl}/Users/${this.userId}/Items?${searchParams.toString()}`;
      const retryResponse = await this.embyFetch(retryUrl);

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(
          `获取 Emby 媒体列表失败 (${retryResponse.status}): ${errorText}`,
        );
      }

      return await retryResponse.json();
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `获取 Emby 媒体列表失败 (${response.status}): ${errorText}`,
      );
    }

    return await response.json();
  }

  async getItem(itemId: string): Promise<EmbyItem> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID，请在管理面板重新保存 Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Users/${this.userId}/Items/${itemId}?Fields=MediaSources${token ? `&api_key=${token}` : ''}`;
    const response = await this.embyFetch(url);

    // 如果是 401 错误且有用户名密码，尝试重新认证
    if (
      response.status === 401 &&
      this.username &&
      this.password &&
      !this.apiKey
    ) {
      const authResult = await this.authenticate(this.username, this.password);
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retryToken = this.authToken;
      const retryUrl = `${this.serverUrl}/Users/${this.userId}/Items/${itemId}?Fields=MediaSources${retryToken ? `&api_key=${retryToken}` : ''}`;
      const retryResponse = await this.embyFetch(retryUrl);

      if (!retryResponse.ok) {
        throw new Error('获取 Emby 媒体详情失败');
      }

      return await retryResponse.json();
    }

    if (!response.ok) {
      throw new Error('获取 Emby 媒体详情失败');
    }

    return await response.json();
  }

  async getSeasons(seriesId: string): Promise<EmbyItem[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID，请在管理面板重新保存 Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}${token ? `&api_key=${token}` : ''}`;
    const response = await this.embyFetch(url);

    // 如果是 401 错误且有用户名密码，尝试重新认证
    if (
      response.status === 401 &&
      this.username &&
      this.password &&
      !this.apiKey
    ) {
      const authResult = await this.authenticate(this.username, this.password);
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retryToken = this.authToken;
      const retryUrl = `${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}${retryToken ? `&api_key=${retryToken}` : ''}`;
      const retryResponse = await this.embyFetch(retryUrl);

      if (!retryResponse.ok) {
        throw new Error('获取 Emby 季列表失败');
      }

      const retryData = await retryResponse.json();
      return retryData.Items || [];
    }

    if (!response.ok) {
      throw new Error('获取 Emby 季列表失败');
    }

    const data = await response.json();
    return data.Items || [];
  }

  async getEpisodes(seriesId: string, seasonId?: string): Promise<EmbyItem[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID，请在管理面板重新保存 Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const searchParams = new URLSearchParams({
      userId: this.userId!,
      Fields: 'MediaSources',
    });

    if (seasonId) {
      searchParams.set('seasonId', seasonId);
    }

    if (token) {
      searchParams.set('api_key', token);
    }

    const url = `${this.serverUrl}/Shows/${seriesId}/Episodes?${searchParams.toString()}`;
    const response = await this.embyFetch(url);

    // 如果是 401 错误且有用户名密码，尝试重新认证
    if (
      response.status === 401 &&
      this.username &&
      this.password &&
      !this.apiKey
    ) {
      const authResult = await this.authenticate(this.username, this.password);
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retrySearchParams = new URLSearchParams({
        userId: this.userId!,
        Fields: 'MediaSources',
      });

      if (seasonId) {
        retrySearchParams.set('seasonId', seasonId);
      }

      if (this.authToken) {
        retrySearchParams.set('api_key', this.authToken);
      }

      const retryUrl = `${this.serverUrl}/Shows/${seriesId}/Episodes?${retrySearchParams.toString()}`;
      const retryResponse = await this.embyFetch(retryUrl);

      if (!retryResponse.ok) {
        throw new Error('获取 Emby 集列表失败');
      }

      const retryData = await retryResponse.json();
      return retryData.Items || [];
    }

    if (!response.ok) {
      throw new Error('获取 Emby 集列表失败');
    }

    const data = await response.json();
    return data.Items || [];
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const token = this.apiKey || this.authToken;
      const url = `${this.serverUrl}/System/Info/Public${token ? `?api_key=${token}` : ''}`;
      const response = await this.embyFetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  getImageUrl(
    itemId: string,
    imageType: 'Primary' | 'Backdrop' | 'Logo' = 'Primary',
    maxWidth?: number,
  ): string {
    const params = new URLSearchParams();
    const token = this.apiKey || this.authToken;

    if (maxWidth) params.set('maxWidth', maxWidth.toString());
    if (token) params.set('api_key', token);

    const queryString = params.toString();
    return `${this.serverUrl}/Items/${itemId}/Images/${imageType}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * 获取 PlaybackInfo 以获取 MediaSourceId
   */
  async getPlaybackInfo(itemId: string): Promise<{ MediaSourceId?: string }> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${this.userId}${token ? `&api_key=${token}` : ''}`;

    try {
      const response = await this.embyFetch(url);

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const mediaSourceId = data.MediaSources?.[0]?.Id;

      return { MediaSourceId: mediaSourceId };
    } catch {
      return {};
    }
  }

  /**
   * 获取媒体项的音轨列表
   */
  async getAudioStreams(itemId: string): Promise<AudioStream[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配置 Emby 用户 ID');
    }

    const token = this.apiKey || this.authToken;

    console.log(
      '🎵 [Client] 开始获取音轨，itemId:',
      itemId,
      'userId:',
      this.userId,
    );

    // 尝试从 PlaybackInfo 获取音轨信息
    try {
      const playbackInfoUrl = `${this.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${this.userId}${token ? `&api_key=${token}` : ''}`;

      console.log('🎵 [Client] 请求 PlaybackInfo:', playbackInfoUrl);

      const response = await this.embyFetch(
        playbackInfoUrl,
        {
          method: 'POST',
          body: JSON.stringify({
            UserId: this.userId,
            StartTimeTicks: 0,
            IsPlayback: true,
            AutoOpenLiveStream: true,
          }),
        },
        true,
      );

      console.log('🎵 [Client] PlaybackInfo 响应状态:', response.status);

      if (response.ok) {
        const data: PlaybackInfoResponse = await response.json();
        console.log('🎵 [Client] PlaybackInfo 数据:', data);

        const streams =
          data.MediaSources?.[0]?.MediaStreams || data.MediaStreams || [];
        console.log('🎵 [Client] 所有流:', streams);

        const audioStreams = streams
          .filter((stream) => stream.Type?.toLowerCase() === 'audio')
          .map((stream) => ({
            index: stream.Index ?? -1,
            displayTitle: stream.DisplayTitle,
            language: stream.Language,
            codec: stream.Codec,
            isDefault: stream.IsDefault ?? false,
          }))
          .filter((stream) => stream.index >= 0)
          .sort((a, b) => a.index - b.index);

        console.log('🎵 [Client] 过滤后的音频流:', audioStreams);

        if (audioStreams.length > 0) {
          return audioStreams;
        }
      }
    } catch (error) {
      console.warn(
        '🎵 [Client] 从 PlaybackInfo 获取音轨失败，尝试从 Item 详情获取:',
        error,
      );
    }

    // 回退：从 Item 详情获取（显式请求 MediaStreams 字段）
    try {
      console.log('🎵 [Client] 尝试从 Item 详情获取音轨');

      // 直接请求 MediaStreams 字段，而不是通过 getItem
      const itemDetailUrl = `${this.serverUrl}/Items/${itemId}?Fields=MediaStreams${token ? `&api_key=${token}` : ''}`;
      console.log('🎵 [Client] 请求 Item 详情:', itemDetailUrl);

      const response = await this.embyFetch(itemDetailUrl);

      if (!response.ok) {
        console.error('🎵 [Client] Item 详情请求失败:', response.status);
        return [];
      }

      const item: PlaybackInfoResponse = await response.json();
      console.log('🎵 [Client] Item 详情响应:', item);

      const streams = item.MediaStreams || [];
      console.log('🎵 [Client] Item MediaStreams:', streams);

      const audioStreams = streams
        .filter((stream) => stream.Type?.toLowerCase() === 'audio')
        .map((stream) => ({
          index: stream.Index ?? -1,
          displayTitle: stream.DisplayTitle,
          language: stream.Language,
          codec: stream.Codec,
          isDefault: stream.IsDefault ?? false,
        }))
        .filter((stream: AudioStream) => stream.index >= 0)
        .sort((a, b) => a.index - b.index);

      console.log('🎵 [Client] 从 Item 获取的音频流:', audioStreams);
      return audioStreams;
    } catch (error) {
      console.error('🎵 [Client] 获取音轨信息失败:', error);
      return [];
    }
  }

  async getStreamUrl(
    itemId: string,
    direct = true,
    forceDirectUrl = false,
    audioStreamIndex?: number,
  ): Promise<string> {
    await this.ensureAuthenticated();
    const token = this.apiKey || this.authToken;

    // 如果启用了代理播放且不是强制获取直接URL，返回代理URL
    if (this.proxyPlay && !forceDirectUrl) {
      // 使用固定的token占位符，实际验证在服务端进行
      const subscribeToken = 'proxy';
      const filename = this.transcodeMp4 ? 'video.mp4' : 'video';

      // 构建代理URL（相对路径）
      let proxyUrl = `/api/emby/play/${subscribeToken}/${filename}?itemId=${itemId}`;

      // 如果有embyKey，添加到查询参数
      if (this.embyKey) {
        proxyUrl += `&embyKey=${this.embyKey}`;
      }

      // 如果指定了音轨，添加到查询参数
      if (typeof audioStreamIndex === 'number' && audioStreamIndex >= 0) {
        proxyUrl += `&audioStreamIndex=${audioStreamIndex}`;
      }

      return proxyUrl;
    }

    // 原有的直接播放逻辑 - 使用 URLSearchParams 构建查询参数
    const query = new URLSearchParams();

    if (direct) {
      // 选项3: 转码mp4 - 使用 HLS 强制音频转码
      if (this.transcodeMp4) {
        // 生成唯一的 PlaySessionId
        const playSessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        query.set('api_key', token || '');
        query.set('AudioCodec', 'aac');
        query.set('AudioBitrate', '320000');
        query.set('MaxAudioChannels', '6');
        query.set('PlaySessionId', playSessionId);

        if (typeof audioStreamIndex === 'number' && audioStreamIndex >= 0) {
          query.set('AudioStreamIndex', String(audioStreamIndex));
        }

        return `${this.serverUrl}/Videos/${encodeURIComponent(itemId)}/master.m3u8?${query.toString()}`;
      } else {
        query.set('static', 'true');
        if (token) {
          query.set('api_key', token);
        }

        if (typeof audioStreamIndex === 'number' && audioStreamIndex >= 0) {
          query.set('AudioStreamIndex', String(audioStreamIndex));
        }

        // 选项2: 拼接MediaSourceId参数
        if (this.appendMediaSourceId) {
          try {
            const playbackInfo = await this.getPlaybackInfo(itemId);
            if (playbackInfo.MediaSourceId) {
              query.set('MediaSourceId', playbackInfo.MediaSourceId);
            }
          } catch {
            // 继续使用不带 MediaSourceId 的 URL
          }
        }

        return `${this.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream?${query.toString()}`;
      }
    } else {
      if (token) {
        query.set('api_key', token);
      }

      if (typeof audioStreamIndex === 'number' && audioStreamIndex >= 0) {
        query.set('AudioStreamIndex', String(audioStreamIndex));
      }

      return `${this.serverUrl}/Videos/${encodeURIComponent(itemId)}/master.m3u8?${query.toString()}`;
    }
  }

  getSubtitles(
    item: EmbyItem,
  ): Array<{ url: string; language: string; label: string }> {
    const subtitles: Array<{ url: string; language: string; label: string }> =
      [];

    if (!item.MediaSources || item.MediaSources.length === 0) {
      return subtitles;
    }

    const mediaSource = item.MediaSources[0];
    if (!mediaSource.MediaStreams) {
      return subtitles;
    }

    const token = this.apiKey || this.authToken;

    mediaSource.MediaStreams.filter(
      (stream) => stream.Type === 'Subtitle',
    ).forEach((stream) => {
      const language = stream.Language || 'unknown';
      const label = stream.DisplayTitle || `${language} (${stream.Codec})`;

      // 外部字幕使用 DeliveryUrl
      if (stream.IsExternal && stream.DeliveryUrl) {
        subtitles.push({
          url: `${this.serverUrl}${stream.DeliveryUrl}`,
          language,
          label,
        });
      } else {
        // 内嵌字幕使用 Stream API
        subtitles.push({
          url: `${this.serverUrl}/Videos/${item.Id}/${mediaSource.Id}/Subtitles/${stream.Index}/Stream.vtt?api_key=${token}`,
          language,
          label,
        });
      }
    });

    return subtitles;
  }
}
