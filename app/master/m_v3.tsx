import { StyleSheet } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  MediaStream,
  RTCView,
  mediaDevices,
  RTCSessionDescription
} from 'react-native-webrtc';
import { Text, View } from '@/components/Themed';
import { newGuid } from '@/lib/util';
import InCallManager from 'react-native-incall-manager';
// --- 核心改动: 导入新的 MQTT 客户端 ---
import { MqttSignalingClient } from '@/lib/mqtt/MqttSignalingClient';
import type { BaseMessageData, AnswerPostData, CallPostData, IcePostData } from '@/types/signal_v3';

// ... (数据通道相关的类型和函数保持不变)
import type MessageEvent from 'react-native-webrtc/lib/typescript/MessageEvent.d.ts';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel.d.ts';
import type RTCDataChannelEvent from 'react-native-webrtc/lib/typescript/RTCDataChannelEvent.d.ts'
import { RTCDataChannelSendMessageProps } from "@/components/type/signal_v2";

// --- 核心改动: 使用 MQTT Broker URL ---
const mqttBrokerUrl = process.env.EXPO_PUBLIC_MQTT_URL;

export default function MasterScreenV3() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // deivceIdRef 现在是这个设备在 MQTT 网络中的唯一身份标识
  const deivceIdRef = useRef<string>(newGuid());
  const sessionIdRef = useRef<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);
  localStreamRef.current = localStream;

  // 使用 Map 存储每个观众的连接
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  // --- 核心改动: 使用 MqttSignalingClient 的 Ref ---
  const mqttClientRef = useRef<MqttSignalingClient | null>(null);

  // --- 所有 WebRTC 和 DataChannel 相关的逻辑 (changeBitrate, handleDataChannel*, createDataChannel, sendMessage, etc.) 保持不变 ---
  // ... (此处省略了所有未改动的 DataChannel 和 WebRTC 辅助函数, 以保持清晰)
  // ... 您原有的 changeBitrate, changeDataChannel, createDataChannel, sendMessage 等函数代码无需修改 ...

  // 初始化摄像头 (保持不变)
  const setupCamera = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[MASTER] 摄像头初始化错误:', err);
      setError('[MASTER] 无法访问摄像头');
      return null;
    }
  };

  // 为特定观众创建 WebRTC 连接 (逻辑不变, 仅修改信令客户端的调用方式)
  const setupPeerConnection = async (viewerId: string, stream: MediaStream) => {
    try {
      console.log(`[MASTER] 为观众 ${viewerId} 初始化 WebRTC...`);
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate && sessionIdRef.current) {
          // --- 改动: 调用新的 MQTT 客户端实例的方法 ---
          mqttClientRef.current?.deviceSendIceCandidate(JSON.stringify(event.candidate));
        }
      });

      // ... 其他 peerConnection 事件监听器保持不变 ...
      peerConnection.addEventListener('connectionstatechange', () => {
        const state = peerConnection.connectionState;
        console.log(`[MASTER] 与观众 ${viewerId} 的连接状态变化:`, state);
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          peerConnections.current.delete(viewerId);
        }
      });

      peerConnections.current.set(viewerId, peerConnection);
      return peerConnection;
    } catch (err) {
      console.error(`[MASTER] 为观众 ${viewerId} 初始化 WebRTC 失败:`, err);
      return null;
    }
  };

  // 创建并发送 offer (逻辑不变, 仅修改信令客户端的调用方式)
  const createAndSendOffer = async (viewerId: string, stream: MediaStream) => {
    const peerConnection = await setupPeerConnection(viewerId, stream);
    if (!peerConnection) return;

    try {
      console.log(`[MASTER] 为观众 ${viewerId} 创建 offer...`);
      const offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await peerConnection.setLocalDescription(offer);

      if (mqttClientRef.current && sessionIdRef.current) {
        // --- 改动: 调用新的 MQTT 客户端实例的方法 ---
        mqttClientRef.current.sendOffer({
          sdp: offer.sdp as string,
          peerId: viewerId,
          sessionId: sessionIdRef.current,
        });
      }
    } catch (err) {
      console.error(`[MASTER] 为观众 ${viewerId} 创建 offer 失败:`, err);
      peerConnections.current.delete(viewerId);
    }
  };

  // --- 核心改动: 事件处理函数 ---
  // 将原先在 callback 对象中的逻辑提取为独立的、可复用的函数
  const handleSignalingConnected = useCallback(() => {
    setConnected(true);
    console.log('[MASTER] 信令服务器连接成功，设备已自动注册。');
    // MqttSignalingClient 会在连接成功后自动发送 _register 消息
  }, []);

  const handleCall = useCallback((data: BaseMessageData & CallPostData) => {
    console.log('[MASTER] 收到呼叫请求:', data);
    const stream = localStreamRef.current;
    if (stream) {
      sessionIdRef.current = data.sessionId;
      // 从 data.from 获取观众的 ID
      createAndSendOffer(data.from, stream);
    } else {
      console.error("[MASTER] 收到呼叫请求，但本地媒体流尚未准备好！");
    }
  }, []); // 依赖于 localStreamRef, 但 ref 不会变，所以空数组即可

  const handleAnswer = useCallback((data: BaseMessageData & AnswerPostData) => {
    console.log('[MASTER] 收到 Answer:', data);
    const peerConnection = peerConnections.current.get(data.from);
    if (peerConnection) {
      peerConnection.setRemoteDescription(new RTCSessionDescription({
        sdp: data.sdp,
        type: data.type as RTCSdpType,
      }));
    } else {
      console.error(`[MASTER] 收到 Answer 但未找到观众 ${data.from} 的 PeerConnection`);
    }
  }, []);

  const handleClientIceCandidate = useCallback(async (data: BaseMessageData & IcePostData) => {
    console.log('[MASTER] 收到观众的 ICE Candidate:', data);
    const candidate = JSON.parse(data.candidate);
    const peerConnection = peerConnections.current.get(data.from);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (err) {
        console.error(`[MASTER] 添加观众 ${data.from} 的 ICE candidate 失败:`, err);
      }
    } else {
      console.error(`[MASTER] 收到 ICE Candidate 但未找到观众 ${data.from} 的 PeerConnection`);
    }
  }, []);

  // --- 核心改动: 使用 useEffect 进行连接和清理 ---
  useEffect(() => {
    let client: MqttSignalingClient | null = null;

    const startBroadcasting = async () => {
      console.log('[MASTER] 开始推流...');
      // 1. 设置摄像头
      const stream = await setupCamera();

      // 2. 如果摄像头成功且有 URL, 则连接信令服务器
      if (stream && mqttBrokerUrl) {
        console.log('[MASTER] 初始化并连接 MQTT 信令客户端...');
        // 实例化 MQTT 客户端
        client = new MqttSignalingClient(mqttBrokerUrl, deivceIdRef.current);
        mqttClientRef.current = client;

        // 注册事件监听器
        client.on('connected', handleSignalingConnected);
        client.on('call', handleCall);
        client.on('answer', handleAnswer);
        client.on('clientIceCandidate', handleClientIceCandidate);

        console.log(client.connect, '%c____connect__', 'background: yellow')
        // 发起连接
        client.connect().catch(e => {
          console.error('[MASTER] 连接 MQTT 信令服务器失败:', e);
          setError('连接信令服务器失败');
        });
      }
    };

    // 启动 InCallManager 和广播
    InCallManager.start({ media: 'audio' });
    InCallManager.setForceSpeakerphoneOn(true);
    startBroadcasting();

    // 组件卸载时的清理函数
    return () => {
      console.log('[MASTER] 组件卸载，执行清理...');
      // 停止 InCallManager
      InCallManager.stop();

      // 释放本地媒体流
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current?.release();

      // 关闭所有 WebRTC 连接
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();

      // 移除事件监听器并断开 MQTT 连接
      const currentClient = mqttClientRef.current;
      if (currentClient) {
        currentClient.off('connected', handleSignalingConnected);
        currentClient.off('call', handleCall);
        currentClient.off('answer', handleAnswer);
        currentClient.off('clientIceCandidate', handleClientIceCandidate);
        currentClient.disconnect();
        mqttClientRef.current = null;
      }
    };
  }, [handleSignalingConnected, handleCall, handleAnswer, handleClientIceCandidate]); // 依赖于 memoized callbacks

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {!connected && !error && <Text style={styles.statusText}>正在连接服务器...</Text>}
      {connected && <Text style={styles.statusText}>设备已上线: {deivceIdRef.current.substring(0, 8)}</Text>}
      {localStream ? (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.stream}
          objectFit="cover"
          mirror={true}
        />
      ) : (
        <Text style={styles.statusText}>正在启动摄像头...</Text>
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
    width: '100%',
    height: '100%',
  },
  statusText: {
    color: 'white',
    fontSize: 18,
    position: 'absolute',
    top: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
  error: {
    color: 'red',
    fontSize: 18,
    textAlign: 'center',
    padding: 20,
  },
});