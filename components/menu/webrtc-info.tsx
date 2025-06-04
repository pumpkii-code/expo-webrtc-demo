import { useState, useRef, useCallback, useEffect } from "react";
import { Text, StyleSheet } from 'react-native';
import { RTCPeerConnection, RTCView, MediaStream, RTCSessionDescription, MediaStreamTrack, mediaDevices } from 'react-native-webrtc';

interface WebRTCInfoProps {
  RTCPeerConnection: RTCPeerConnection | null;
}

export default function WebRTCConnectInfo({ RTCPeerConnection }: WebRTCInfoProps) {
  // 新增状态用于存储带宽和FPS
  const [currentBitrateKbps, setCurrentBitrateKbps] = useState<number>(0);
  const [currentFps, setCurrentFps] = useState<number>(0);

  // 用于存储上一次的统计数据
  const lastBytesReceived = useRef<number>(0);
  const lastTimestamp = useRef<number>(0);
  const lastFramesDecoded = useRef<number>(0);

  const startStatsCollection = useCallback(() => {
    if (!RTCPeerConnection) return;

    const collectStats = async () => {
      if (!RTCPeerConnection) return;

      try {
        const stats = await RTCPeerConnection?.getStats();
        let totalBytesReceived = 0;
        let totalFramesDecoded = 0;

        stats.forEach((report: { type: string; kind: string; bytesReceived: any; framesDecoded: any; }) => {
          console.log('----001', report.type === 'inbound-rtp', report.kind === 'video', report);
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            totalBytesReceived += report.bytesReceived || 0;
            totalFramesDecoded += report.framesDecoded || 0;
            console.log(`Received ${report.bytesReceived} bytes in ${report.framesDecoded} frames`);
          }
        });

        const currentTime = Date.now();
        console.log(lastTimestamp.current !== 0, currentTime > lastTimestamp.current, stats)
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
    const intervalId = setInterval(collectStats, 1000);

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
    </>
  )
}

const styles = StyleSheet.create({
  statsText: {
    color: 'white',
    fontSize: 14,
  },
});