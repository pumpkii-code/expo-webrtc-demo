import { useState, useRef, useCallback, useEffect } from "react";
import { Text, StyleSheet } from 'react-native';
import { RTCPeerConnection, RTCView, MediaStream, RTCSessionDescription, MediaStreamTrack, mediaDevices } from 'react-native-webrtc';
import { RTCStatsArray, RTCStatsCandidatePair, RTCStatsGoogCandidatePair } from "../type/signal_v2";

interface WebRTCInfoProps {
  RTCPeerConnection: RTCPeerConnection | null;
  connectedNumber: number;
}

const DEFAULT_TIMEOUT = 5000;

export default function WebRTCConnectInfo({ RTCPeerConnection, connectedNumber }: WebRTCInfoProps) {
  // 新增状态用于存储带宽和FPS
  const [currentBitrateKbps, setCurrentBitrateKbps] = useState<number>(0);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [currentRemoteMode, setCurrentRemoteMode] = useState<string>(''); // 新增状态用于存储连接模式 inf
  const [currentLoaclMode, setCurrentLoaclMode] = useState<string>(''); // 新增状态用于存储连接模式 inf
  const [decodeType, setDecodeType] = useState<string>('unknown'); // 新增状态用于存储连接模式 inf

  // 用于存储上一次的统计数据
  const lastBytesReceived = useRef<number>(0);
  const lastTimestamp = useRef<number>(0);
  const lastFramesDecoded = useRef<number>(0);
  const [activeMiniType, setActiveMiniType] = useState<string>('');

  const startStatsCollection = useCallback(() => {
    if (!RTCPeerConnection) return;

    const collectStats = async () => {
      if (!RTCPeerConnection) return;

      try {
        const stats = await RTCPeerConnection?.getStats() as RTCStatsArray;
        let activeCandidatePair: RTCStatsCandidatePair | RTCStatsGoogCandidatePair | undefined
        let totalBytesReceived = 0;
        let totalFramesDecoded = 0;
        let activeCodecId = ''; // 存储当前的 active codec id
        let inboundVideoReport: any = null;
        const codecReports: { [id: string]: any } = {};

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            console.log('%c_____report', 'background:aquamarine', report)
            totalBytesReceived += report.bytesReceived || 0;
            totalFramesDecoded += report.framesDecoded || 0;

            if (report.bytesReceived && report.bytesReceived > 0) {
              const implementation = report.decoderImplementation

              if (implementation) {
                console.log('%c_____report', 'background:red', implementation, typeof report.powerEfficientDecoder === 'boolean', report)
                if (implementation.toLowerCase().includes('google') || implementation.toLowerCase().includes('libvpx')) {
                  setDecodeType('software');

                } else if (implementation.toLowerCase().startsWith('omx.') || implementation.toLowerCase().startsWith('c2.') || implementation.toLowerCase() === 'videotoolbox') {
                  setDecodeType('hardware');
                }


              } else {
                // 如果两个字段都没有，则无法确定
                setDecodeType('unknown');
              }
            }

            if (report.packetsReceived && report.packetsReceived > 0) {
              inboundVideoReport = report;
            }
          }

          if (report.type === 'codec') {
            codecReports[report.id] = report;
          }

          // 2. 检查我们是否找到了活跃的视频流报告，以及它是否有 codecId
          if (inboundVideoReport && inboundVideoReport.codecId) {
            // 3. 使用 inboundVideoReport 的 codecId 从我们自己创建的 codecReports 对象中查找对应的编解码器
            const activeCodec = codecReports[inboundVideoReport.codecId];

            if (activeCodec && activeCodec.mimeType) {
              // 4. 返回编解码器的 mimeType，例如 "video/vp9"
              setActiveMiniType(activeCodec.mimeType);
            }
          }

          // 'googCandidatePair' 是旧的 Chrome 实现，标准的是 'candidate-pair'
          if (report.type === 'candidate-pair' || report.type === 'googCandidatePair') {
            // console.log('%c_____report', 'background:aquamarine', report)
            // 'succeeded' 意味着这个候选者对被用于数据传输
            // 'nominated: true' 也表示这个是被选中的
            if (report.state === 'succeeded' && (report.nominated === 1 || report.nominated === true)) {
              activeCandidatePair = report;
              // console.log('%c_____successed get activeCandidatePair', 'background:aquamarine', activeCandidatePair)
            }
            // 有些实现可能只有 state: 'succeeded'
            // if (report.state === 'succeeded' && !activeCandidatePair) {
            //   activeCandidatePair = report;
            // }
          }
        });

        if (activeCandidatePair) {
          const localCandidateId = activeCandidatePair.localCandidateId;
          const remoteCandidateId = activeCandidatePair.remoteCandidateId;

          let localCandidateType = 'unknown';
          let remoteCandidateType = 'unknown';

          stats.forEach(report => {
            if (report.id === localCandidateId) {
              localCandidateType = 'candidateType' in report ? report?.candidateType : report.type; // candidateType 是标准字段
              setCurrentLoaclMode(localCandidateType)
            }
            if (report.id === remoteCandidateId) {
              remoteCandidateType = 'candidateType' in report ? report?.candidateType : report.type;
              setCurrentRemoteMode(remoteCandidateType)
            }
          });

          // console.log('Active Candidate Pair (from getStats):');
          // console.log('Local candidate type:', localCandidateType);
          // console.log('Remote candidate type:', remoteCandidateType);
          // activeCandidatePair 中也可能有 IP 地址等信息，如 activeCandidatePair.remoteAddress

          if (remoteCandidateType === 'host') {
            // console.log('Connection Mode (from getStats): Host-to-Host (Direct P2P in same network)');
          } else if (remoteCandidateType === 'srflx' || remoteCandidateType === 'serverreflexive') {
            // console.log('Connection Mode (from getStats): Server Reflexive (P2P via STUN)');
          } else if (remoteCandidateType === 'prflx' || remoteCandidateType === 'peerreflexive') {
            // console.log('Connection Mode (from getStats): Peer Reflexive (P2P via STUN, NAT-to-NAT)');
          } else if (remoteCandidateType === 'relay' || remoteCandidateType === 'relayed') {
            // console.log('Connection Mode (from getStats): Relayed (via TURN server)');
          } else {
            // console.log('Connection Mode (from getStats): Could not determine precisely or other P2P type.');
          }
        } else {
          console.warn('No active (succeeded and nominated) candidate pair found in stats.');
        }

        const currentTime = Date.now();
        // console.log(lastTimestamp.current !== 0, currentTime > lastTimestamp.current, stats)
        if (lastTimestamp.current !== 0 && currentTime > lastTimestamp.current) {
          const timeDiffSeconds = (currentTime - lastTimestamp.current) / 1000;

          // 计算带宽 (kbps)
          const bytesReceivedDiff = totalBytesReceived - lastBytesReceived.current;
          const bitrateKbps = (bytesReceivedDiff * 8) / 1000 / timeDiffSeconds;
          setCurrentBitrateKbps(bitrateKbps);

          // 计算 FPS
          const framesDecodedDiff = totalFramesDecoded - lastFramesDecoded.current;
          const fps = framesDecodedDiff / timeDiffSeconds;
          setCurrentFps(fps);
        }

        lastBytesReceived.current = totalBytesReceived;
        lastTimestamp.current = currentTime;
        lastFramesDecoded.current = totalFramesDecoded;

      } catch (error) {
        console.error('Failed to get WebRTC stats:', error);
      }
    };

    // 每秒收集一次统计数据
    collectStats();
    const intervalId = setInterval(collectStats, DEFAULT_TIMEOUT);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const cleanupStats = startStatsCollection();

    return () => {
      if (cleanupStats) {
        cleanupStats();
      }
    };
  }, []);

  return (
    <>
      <Text style={styles.statsText}>Bitrate: {currentBitrateKbps.toFixed(2)} kbps</Text>
      <Text style={styles.statsText}>FPS: {currentFps.toFixed(2)}</Text>
      <Text style={styles.statsText}>Mode: {currentLoaclMode + ' / ' + currentRemoteMode}</Text>
      <Text style={styles.statsText}>Num: {connectedNumber}</Text>
      <Text style={styles.statsText}>Type: {decodeType}</Text>
      <Text style={styles.statsText}>Type2: {activeMiniType}</Text>
    </>
  )
}

const styles = StyleSheet.create({
  statsText: {
    color: 'white',
    fontSize: 14,
  },
});