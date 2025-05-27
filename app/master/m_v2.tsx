import { StyleSheet } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  MediaStream,
  RTCView,
  mediaDevices,
  RTCSessionDescription
} from 'react-native-webrtc';
import { Text, View } from '@/components/Themed';
import { SignalingClient } from '@/lib/signal';
import { useRoute } from '@react-navigation/native';
import { SignalingClientV2 } from '@/lib/signal_v2';
import { newGuid } from '@/lib/util';
import InCallManager from 'react-native-incall-manager';

const wsUrl = 'ws://192.168.3.65:8910';

export default function MasterScreen() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { serno: peerId } = (useRoute().params ?? { serno: '' }) as { serno: string };
  const sessionIdRef = useRef<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);
  localStreamRef.current = localStream;
  const [audioDevices, setAudioDevices] = useState<MediaStream | null>(null);
  const audioDeviceIdRef = useRef<MediaStream | null>(null); // 存储当前选中的音频设备 ID
  audioDeviceIdRef.current = audioDevices;

  // 使用 Map 存储每个观众的连接
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingClientV2 = useRef<SignalingClientV2 | null>(null);

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
        if (event.candidate && sessionIdRef.current) {
          console.log(`[MASTER] 发送 ICE candidate 到观众 ${viewerId}:`, event);
          signalingClientV2.current?.deviceSendIceCandidate(JSON.stringify(event.candidate), viewerId, sessionIdRef.current);
        } else {
          console.log(`[MASTER] 观众 ${viewerId} 的 ICE candidate 收集完成`);
        }
      });

      peerConnection.addEventListener('track', (event) => {
        console.log(`%c_____[MASTER] 收到观众 ${viewerId} 的媒体流___`, 'background: red');
        setAudioDevices(event.streams[0]);
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

      peerConnection.addEventListener('datachannel', () => {
        console.log('%c___ datachannel ____', 'background: blue');
      });

      peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log('%c___ icegatheringstatechange ____', 'background: blue');
      });

      peerConnection.addEventListener('iceconnectionstatechange', () => {
        console.log('%c___ datachannel ____', 'background: blue');
      });

      peerConnection.addEventListener('signalingstatechange', () => {
        console.log('%c___ datachannel ____', 'background: blue');
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

      if (signalingClientV2.current && sessionIdRef.current) {
        const sendData = {
          sdp: offer.sdp,
          peerId: viewerId,
          sessionId: sessionIdRef.current,
          state: 'successed'
        }
        signalingClientV2.current.sendOffer(sendData);
      }
    } catch (err) {
      console.error(`[MASTER] 为观众 ${viewerId} 创建 offer 失败:`, err);
      peerConnections.current.delete(viewerId);
    }
  };

  // 连接信令服务器
  const connectSignaling = (serverUrl: string, stream: MediaStream) => {
    console.log('开始连接信令服务器');
    signalingClientV2.current = new SignalingClientV2(serverUrl, newGuid());

    signalingClientV2.current.connect({
      onConnected: () => {
        setConnected(true);
        console.log('连接信令服务器成功');
        signalingClientV2.current?.registerDevice(peerId);
      },

      onCall: (data) => {
        console.log('收到呼叫');
        sessionIdRef.current = data.sessionId;
        createAndSendOffer(data.from, stream);
      },

      onAnswer: (data) => {
        console.log('%c____收到回答_____', 'background: yellow', data);
        const peerConnection = peerConnections.current.get(data.from);
        if (peerConnection) {
          peerConnection.setRemoteDescription(new RTCSessionDescription({
            sdp: data.sdp,
            type: data.type as RTCSdpType,
          }));
        }
      },

      // onOffer: async (data) => {
      //   console.log('%c____收到来自 client 的 offer_____002', 'background: yellow', data);
      //   sessionIdRef.current = data.sessionId;
      //   const peerConnection = peerConnections.current.get(data.from);
      //   await peerConnection?.createAnswer().then((answer) => {
      //     console.log('%c____收到来自 client 的 offer_____001', 'background: yellow', data);
      //     peerConnection?.setLocalDescription(answer);
      //   });
      // },

      onClientIceCandidate: async (data) => {
        const { from } = data;
        const candidate = JSON.parse(data.candidate); // 解析 ICE candidate
        console.log('收到 ICE candidate', data);
        const peerConnection = peerConnections.current.get(from);
        if (!peerConnection) {
          console.error(`[MASTER] 未找到观众 ${from} 的连接`);
          return;
        }
        try {
          await peerConnection.addIceCandidate(candidate);
          console.log(`[MASTER] 添加观众 ${from} 的 ICE candidate 成功 :D ____`); // 打印到 cons
        } catch (err) {
          console.error(`[MASTER] 添加观众 ${from} 的 ICE candidate 失败:`, err);
        }
      },
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
    try {
      InCallManager.start({ media: 'audio' });
      InCallManager.setForceSpeakerphoneOn(true);
      console.log('扬声器已打开 (手动测试)');
    } catch (e) {
      console.error('手动测试扬声器失败:', e);
    }
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
      if (signalingClientV2.current) {
        signalingClientV2.current.disconnect();
        signalingClientV2.current = null;
      }
    };
    startBroadcasting();
    return () => {
      cleanup();
      InCallManager.stop();
    }

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
        <>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.stream}
            objectFit="cover"
          />
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.stream}
            objectFit="cover"
          />
        </>
      )}
      {audioDevices && (
        <RTCView
          streamURL={audioDevices.toURL()}
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