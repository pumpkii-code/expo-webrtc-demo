import { StyleSheet } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  MediaStream,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import { Text, View } from '@/components/Themed';
import { SignalingClient } from '@/lib/signal';
import { useRoute } from '@react-navigation/native';

const wsUrl = 'ws://192.168.3.207:8080';

export default function MasterScreen() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const  localStreamRef = useRef<MediaStream | null>(localStream);
  localStreamRef.current = localStream;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {serno: peerId} = (useRoute().params ?? {serno: ''}) as {serno: string};

  // 使用 Map 存储每个观众的连接
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingClient = useRef<SignalingClient | null>(null);

  // 初始化摄像头
  const setupCamera = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[MASTER] 摄像头初始化错误:', err);
      setError('[MASTER] 无法访问摄像头');
      return null;
    }
  };

  // 为特定观众创建 WebRTC 连接
  const setupPeerConnection = async (viewerId: string, stream: MediaStream) => {
    try {
      console.log(`[MASTER] 为观众 ${viewerId} 初始化 WebRTC...`);
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // 添加本地流
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // 处理 ICE candidate
      peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          console.log(`[MASTER] 发送 ICE candidate 到观众 ${viewerId}:`, event.candidate);
          signalingClient.current?.sendCandidate(event.candidate, viewerId);
        } else {
          console.log(`[MASTER] 观众 ${viewerId} 的 ICE candidate 收集完成`);
        }
      });

      // 监听连接状态
      peerConnection.addEventListener('connectionstatechange', () => {
        const state = peerConnection.connectionState;
        console.log(`[MASTER] 与观众 ${viewerId} 的连接状态变化:`, state);
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          console.log(`[MASTER] 与观众 ${viewerId} 的连接已断开`);
          peerConnections.current.delete(viewerId);
        }
      });

      // 存储连接
      peerConnections.current.set(viewerId, peerConnection);
      return peerConnection;
    } catch (err) {
      console.error(`[MASTER] 为观众 ${viewerId} 初始化 WebRTC 失败:`, err);
      return null;
    }
  };

  
  // 创建并发送 offer
  const createAndSendOffer = async (viewerId: string, stream?: MediaStream) => {
    if (!stream) {
      console.error('[MASTER] 本地流未初始化');
      return;
    }

    const peerConnection = await setupPeerConnection(viewerId, stream);
    if (!peerConnection) return;

    try {
      console.log(`[MASTER] 为观众 ${viewerId} 创建 offer...`);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peerConnection.setLocalDescription(offer);
      
      if (signalingClient.current) {
        signalingClient.current.sendOffer(offer.sdp, viewerId);
      }
    } catch (err) {
      console.error(`[MASTER] 为观众 ${viewerId} 创建 offer 失败:`, err);
      peerConnections.current.delete(viewerId);
    }
  };

  // 连接信令服务器
  const connectSignaling = (serverUrl: string, stream:MediaStream) => {
    console.log('开始连接信令服务器');
    signalingClient.current = new SignalingClient(serverUrl);
    
    signalingClient.current.connect({
      onConnected: () => {
        setConnected(true);
        setError(null);
        signalingClient.current?.register(peerId);
      },
      onIncomingConnection: (data) => {
        console.log('收到观众端连接请求:', data);
        if (data.from) {
          createAndSendOffer(data.from, stream);
        }
      },
      onDisconnected: () => {
        setConnected(false);
        // 清理所有连接
        peerConnections.current.forEach(pc => pc.close());
        peerConnections.current.clear();
      },
      onError: (errorMessage) => {
        setError(errorMessage);
      },
      onAnswer: async (description, from) => {
        const peerConnection = peerConnections.current.get(from);
        if (!peerConnection) {
          console.error(`[MASTER] 未找到观众 ${from} 的连接`);
          return;
        }
        try {
          await peerConnection.setRemoteDescription(description);
        } catch (err) {
          console.error(`[MASTER] 设置观众 ${from} 的远程描述时出错:`, err);
          peerConnections.current.delete(from);
        }
      },
      onCandidate: async (candidate, from) => {
        const peerConnection = peerConnections.current.get(from);
        if (!peerConnection) {
          console.error(`[MASTER] 未找到观众 ${from} 的连接`);
          return;
        }
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (err) {
          console.error(`[MASTER] 添加观众 ${from} 的 ICE candidate 失败:`, err);
        }
      }
    });
  };

  // 开始推流
  const startBroadcasting = async () => {
    console.log('[MASTER] 开始推流');
    const stream = await setupCamera();
    if (stream) {
      connectSignaling(wsUrl, stream);
    }
    return stream
  };

  useEffect(() => {
    const cleanup = () => {
      const strem = localStreamRef.current;
      console.log('[MASTER] 执行清理函数');
      if (strem) {
        // strem.getTracks().forEach(track => {
        //   track.stop();
        //   track.enabled = false; // 明确禁用轨道
        // });
        strem.release(); // 释放资源
      }
      // 清理所有连接
      peerConnections.current.forEach(pc => {
        pc.close();
        pc.getSenders().forEach(sender => sender.track?.stop());
      });
      peerConnections.current.clear();
      if (signalingClient.current) {
        signalingClient.current.disconnect();
        signalingClient.current = null;
      }
    };
    startBroadcasting();
    return ()=> cleanup();
   
  }, []);

  return (
    <View style={styles.container}>
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
      {!connected && !error && (
        <Text>正在连接服务器...</Text>
      )}
      {localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.stream}
          objectFit="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  stream: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
});