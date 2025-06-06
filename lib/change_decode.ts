/**
 * 修改 SDP 字符串，将指定的编解码器设置为首选。
 * @param sdp 原始 SDP 字符串。
 * @param preferredCodec 要设置为首选的编解码器名称 (例如 'H264', 'VP8', 'VP9')。
 * @returns 修改后的 SDP 字符串。
 */
export const preferCodec = (
  sdp: string,
  codecName: 'VP9' | 'H264' | 'VP8' | 'H265'
): string => {
  if (!sdp) {
    return '';
  }

  // 将 SDP 按行分割
  const lines = sdp.split('\r\n');

  // 查找视频媒体描述行 'm=video...'
  const mLineIndex = lines.findIndex((line) => line.startsWith('m=video'));
  if (mLineIndex === -1) {
    console.warn('Cannot find m=video line in SDP');
    return sdp;
  }

  // 从 'm=' 行中提取 payload types
  // m=video 9 UDP/TLS/RTP/SAVPF 100 101 102 ...
  const mLine = lines[mLineIndex];
  const mLineParts = mLine.split(' ');
  // 第 0, 1, 2 部分是 "m=video", "9", "UDP/..."
  const payloadTypes = mLineParts.slice(3);

  // 查找与目标编解码器关联的 payload type
  const codecRegex = new RegExp(`a=rtpmap:(\\d+) ${codecName}\\/\\d+`);
  let preferredPayload: string | null = null;
  for (const line of lines) {
    const match = line.match(codecRegex);
    if (match) {
      preferredPayload = match[1];
      break;
    }
  }

  if (!preferredPayload) {
    console.warn(`Codec ${codecName} not found in SDP.`);
    return sdp;
  }

  // 过滤掉已找到的 payload type，剩下的作为其他
  const otherPayloads = payloadTypes.filter((pt) => pt !== preferredPayload);

  // 重组 m= 行，将偏好的 payload type 放在最前面
  const newMLine = [
    ...mLineParts.slice(0, 3),
    preferredPayload,
    ...otherPayloads,
  ].join(' ');

  // 替换原始的 m= 行
  lines[mLineIndex] = newMLine;

  return lines.join('\r\n');
};
