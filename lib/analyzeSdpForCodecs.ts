// (上面的 interface 定义)
import { Platform } from 'react-native';

export interface CodecInfo {
  payloadType: string;
  name: 'H264' | 'H265' | 'HEVC';
  clockRate: string;
  fmtp?: string; // a=fmtp 参数是可选的
  /**
   * 编解码器类型（软/硬）。
   * 注意：这是一个基于平台和经验的推断，并非 100% 精确。
   */
  type: 'hardware (assumed)' | 'hardware' | 'unknown';
}

/**
 * 在解析过程中使用的中间类型
 */
interface PartialCodecInfo {
  name?: string;
  clockRate?: string;
  fmtp?: string;
}

/**
 * 推断编解码器是硬件实现还是软件实现。
 * 这是一个基于经验的估计，因为 SDP 没有提供此信息的标准字段。
 * @param codec - 部分编解码器信息。
 * @returns 一个表示可能实现类型的字符串。
 */
function inferHardwareOrSoftware(codec: PartialCodecInfo): CodecInfo['type'] {
  // 在 iOS 上，WebRTC 默认使用 VideoToolbox 进行 H.264/H.265 编解码，这是硬件加速的。
  if (Platform.OS === 'ios') {
    return 'hardware (assumed)';
  }

  // 在 Android 上，仅通过 SDP 很难区分。
  // 最可靠的方法是检查 `adb logcat` 中的 MediaCodec 日志。
  // 'OMX.google.*' 是软件，'OMX.<vendor>.*' 或 'c2.<vendor>.*' 是硬件。
  // 由于我们无法从 JS 层获取这些信息，所以返回 'unknown'。
  // 如果未来发现特定于硬件的 fmtp 参数，可以在此处添加逻辑。
  // if (codec.fmtp?.includes('some-hw-specific-param')) {
  //   return 'hardware';
  // }

  return 'unknown';
}

/**
 * 解析 SDP 字符串以提取 H.264 和 H.265/HEVC 视频编解码器的信息。
 * @param sdp - 来自 RTCSessionDescription 的 SDP 字符串。
 * @returns 一个包含支持的 H.264/H.265 编解码器信息的对象数组。
 */
export function analyzeSdpForCodecs(sdp: string): CodecInfo[] {
  const finalCodecs: CodecInfo[] = [];
  const lines = sdp.split('\r\n');

  let isVideoSection = false;
  // 使用 Map 存储载荷类型 (payload type) 到编解码器信息的映射
  const payloadTypeMap = new Map<string, PartialCodecInfo>();

  for (const line of lines) {
    if (line.startsWith('m=video')) {
      isVideoSection = true;
      // 从 m-line 中提取所有的 payload types
      const parts = line.split(' ');
      // 从第4个元素（索引3）开始是 payload type 列表
      for (let i = 3; i < parts.length; i++) {
        payloadTypeMap.set(parts[i], {}); // 为每个 payload type 初始化一个空对象
      }
      continue; // 继续下一行
    }

    if (!isVideoSection) {
      continue; // 只处理 video section 内部的行
    }

    if (line.startsWith('a=rtpmap:')) {
      // 示例: a=rtpmap:96 H264/90000
      const match = line.substring(9).match(/(\d+)\s+([a-zA-Z0-9\-]+)\/(\d+)/);
      if (match) {
        const [, payloadType, codecName, clockRate] = match;
        const codecInfo = payloadTypeMap.get(payloadType);
        if (codecInfo) {
          codecInfo.name = codecName.toUpperCase();
          codecInfo.clockRate = clockRate;
        }
      }
    } else if (line.startsWith('a=fmtp:')) {
      // 示例: a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1
      const parts = line.substring(7).split(' ');
      const payloadType = parts.shift(); // 第一个元素是 payload type
      if (payloadType) {
        const codecInfo = payloadTypeMap.get(payloadType);
        if (codecInfo) {
          codecInfo.fmtp = parts.join(' '); // 剩余部分是参数
        }
      }
    }
  }

  // 遍历 Map，筛选并格式化我们需要的编解码器信息
  for (const [pt, codec] of payloadTypeMap.entries()) {
    if (
      codec.name &&
      (codec.name === 'H264' || codec.name === 'H265' || codec.name === 'HEVC')
    ) {
      // 确保关键信息存在，满足 CodecInfo 类型的要求
      if (codec.name && codec.clockRate) {
        finalCodecs.push({
          payloadType: pt,
          name: codec.name as CodecInfo['name'],
          clockRate: codec.clockRate,
          fmtp: codec.fmtp, // 如果不存在则为 undefined
          type: inferHardwareOrSoftware(codec),
        });
      }
    }
  }

  return finalCodecs;
}
