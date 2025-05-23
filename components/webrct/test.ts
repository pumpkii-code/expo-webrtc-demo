class VideoStreamManager {
  private static instance: VideoStreamManager;
  private videoStream: MediaStream | null = null;

  // 私有构造函数，防止外部实例化
  private constructor() {}

  // 获取单例实例的方法
  public static getInstance(): VideoStreamManager {
    if (!VideoStreamManager.instance) {
      VideoStreamManager.instance = new VideoStreamManager();
    }
    return VideoStreamManager.instance;
  }

  // 设置视频流
  public setVideoStream(stream: MediaStream) {
    this.videoStream = stream;
  }

  // 获取视频流
  public getVideoStream(): MediaStream | null {
    return this.videoStream;
  }

  // 清除视频流
  public clearVideoStream() {
    this.videoStream = null;
  }
}

export default VideoStreamManager;
