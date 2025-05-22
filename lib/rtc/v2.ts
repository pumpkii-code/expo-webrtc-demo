import { useRef, useState, useCallback, useEffect } from 'react';
import { RTCPeerConnection, MediaStream } from 'react-native-webrtc';

interface UseWebRTCOptions {
  role: 'master' | 'viewer';
  iceServers?: RTCIceServer[];
}

export function useWebRTC({
  role,
  iceServers = [{ urls: 'stun:stun.l.google.com:19302' }],
}: UseWebRTCOptions) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    RTCPeerConnectionState | undefined
  >('new');

  // 清理函数
  const cleanupWebRTC = useCallback(() => {
    if (pc.current) {
      pc.current.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });
      pc.current.close();
    }
    pc.current = null;
    setError(null);
    setConnectionState('closed');
  }, [role]);

  useEffect(() => {
    return () => {
      stream?.release?.();
    };
  }, [stream]);

  // 初始化 PeerConnection 并监听事件
  const setupWebRTC = useCallback(async () => {
    if (pc.current) {
      const currentState = pc.current.connectionState;
      if (
        currentState !== 'new' &&
        currentState !== 'closed' &&
        currentState !== 'failed'
      ) {
        cleanupWebRTC();
      } else if (currentState === 'closed' || currentState === 'failed') {
        pc.current = null;
      }
    }
    setStream(null);

    try {
      pc.current = new RTCPeerConnection({ iceServers });
      setConnectionState(pc.current.connectionState);

      // 监听远程流
      pc.current.addEventListener('track', (event: any) => {
        if (event.streams && event.streams[0]) {
          setStream(event.streams[0]);
        } else if (event.track) {
          const newStream = new MediaStream();
          newStream.addTrack(event.track);
          setStream(newStream);
        }
      });

      // 监听连接状态
      pc.current.addEventListener('connectionstatechange', () => {
        const newState = pc.current?.connectionState;
        setConnectionState(newState);
        if (newState === 'failed') {
          setError(`[${role.toUpperCase()}] WebRTC connection failed.`);
        } else if (newState === 'disconnected') {
          // 可根据需要处理
        } else if (newState === 'closed') {
          // 可根据需要处理
        } else {
          setError(null);
        }
      });

      // 监听 ICE candidate（如需信令交互可在外部添加）
      pc.current.addEventListener('icecandidate', (event: any) => {
        // 这里可以通过信令发送 candidate
        // event.candidate
      });

      return true;
    } catch (e: any) {
      setError(
        `[${role.toUpperCase()}] Failed to initialize WebRTC: ${e.message}`
      );
      cleanupWebRTC();
      return false;
    }
  }, [role, iceServers, cleanupWebRTC]);

  return {
    pc,
    stream,
    error,
    state: connectionState,
    setupWebRTC,
    cleanupWebRTC,
  };
}
