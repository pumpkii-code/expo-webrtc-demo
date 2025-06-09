import { Button, StyleSheet } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type MessageEvent from 'react-native-webrtc/lib/typescript/MessageEvent.d.ts';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel.d.ts';
import type RTCDataChannelEvent from 'react-native-webrtc/lib/typescript/RTCDataChannelEvent.d.ts'
import { RTCDataChannelSendMessageProps } from "@/components/type/signal_v2";
import { preferCodec } from '@/lib/change_decode';

const wsUrl = 'ws://192.168.3.65:7001';

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
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const webrtcInfoIntervalId = useRef<number | null>(null);

  const changeBitrate = (data: { bitrate: number }, currentId: string) => {

    // 确保 data 包含有效的码率值
    if (!data || typeof data.bitrate !== 'number') {
      console.error('无效的码率数据', data);
      return;
    }

    const bitrate = data.bitrate; // 单位：bps

    // 遍历所有活跃的对等连接
    peerConnections.current.forEach((pc, viewerId) => {
      // 获取所有发送器
      if (viewerId !== currentId) return;
      const senders = pc.getSenders();

      // 找到视频发送器
      const videoSender = senders.find(sender =>
        sender.track && sender.track.kind === 'video'
      );

      if (videoSender) {
        // 获取当前参数
        const parameters = videoSender.getParameters();

        // 确保参数对象已初始化
        if (!parameters.encodings) {
          parameters.encodings = [];
        }

        // 设置最大码率
        // 如果有多个编码层，可以分别设置
        parameters.encodings.forEach(encoding => {
          encoding.maxBitrate = bitrate;
        });

        // 应用新参数
        videoSender.setParameters(parameters)
          .then(() => {
            console.log(`成功为观众 ${viewerId} 设置新码率: ${bitrate}bps`);
            sendMessage({
              type: 'changeBitrate',
              data: JSON.stringify({
                state: 'successed',
                bitrate: bitrate
              }),
              targetViewerId: viewerId
            })
          })
          .catch(error => {
            sendMessage({
              type: 'changeBitrate',
              data: JSON.stringify({
                state: 'failed',
              }),
              targetViewerId: viewerId
            })
            console.error(`为观众 ${viewerId} 设置码率失败:`, error);
          });
      } else {
        console.warn(`未找到观众 ${viewerId} 的视频发送器`);
      }
    });
  }

  // 使用 Map 存储每个观众的连接
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingClientV2 = useRef<SignalingClientV2 | null>(null);

  const handleDataChannelOpen = (event: RTCDataChannelEvent<'open'>) => {
    console.log('Data channel opened for viewer:');
  }

  const handleDataChannelMessage = (event: MessageEvent<'message'>) => {
    const data = event.data as string;
    const message = JSON.parse(data);

    switch (message.type) {
      case 'changeBitrate':
        changeBitrate(JSON.parse(message.data), message.viewerId);
        break;

      default:
        break;
    }
  };

  const handleDataChannelError = (event: RTCDataChannelEvent<'error'>) => {
    console.error('Data channel error:', event);
  };

  // const removeDataChannelListeners = (dataChannel: RTCDataChannel, viewerId: string) => {
  //   dataChannel.removeEventListener('open', handleDataChannelOpen);
  //   dataChannel.removeEventListener('message', handleDataChannelMessage);
  //   dataChannel.removeEventListener('error', handleDataChannelError);
  //   dataChannel.removeEventListener('close', handleDataChannelClose);

  //   dataChannels.delete(viewerId);

  // }

  const handleDataChannelClose = (event: RTCDataChannelEvent<'close'>) => {
    console.log('Data channel closed:', event.channel);
  };

  const changeDataChannel = useCallback(() => {
    // 添加数据通道的方法
    const set = (viewerId: string, dataChannel: RTCDataChannel) => {
      dataChannelsRef.current.set(viewerId, dataChannel);
      dataChannel.addEventListener('open', handleDataChannelOpen);
      dataChannel.addEventListener('message', handleDataChannelMessage);
      dataChannel.addEventListener('error', handleDataChannelError);
      dataChannel.addEventListener('close', handleDataChannelClose);

      // 当添加数据通道时，启动定时器
      startWebRTCInfoTimer();
    };

    // 删除数据通道的方法
    const _delete = (viewerId: string) => {
      const dataChannel = dataChannelsRef.current.get(viewerId);
      if (dataChannel) {
        // 移除事件监听器
        dataChannel.removeEventListener('open', handleDataChannelOpen);
        dataChannel.removeEventListener('message', handleDataChannelMessage);
        dataChannel.removeEventListener('error', handleDataChannelError);
        dataChannel.removeEventListener('close', handleDataChannelClose);

        // 关闭数据通道
        if (dataChannel.readyState === 'open') {
          dataChannel.close();
        }

        // 从 Map 中删除
        dataChannelsRef.current.delete(viewerId);
        console.log(`Data channel removed for viewer: ${viewerId}`);

        // 检查是否需要停止定时器
        if (dataChannelsRef.current.size === 0) {
          stopWebRTCInfoTimer();
        }
      } else {
        console.warn(`No data channel found for viewer: ${viewerId}`);
      }
    };

    // 获取所有数据通道
    const getAll = () => {
      return dataChannelsRef.current;
    };

    // 获取特定的数据通道
    const get = (viewerId: string) => {
      return dataChannelsRef.current.get(viewerId);
    };

    // 清空所有数据通道
    const clear = () => {
      dataChannelsRef.current.forEach((dataChannel, viewerId) => {
        _delete(viewerId);
      });
      // 清空后停止定时器
      stopWebRTCInfoTimer();
    };

    // 启动 WebRTC 信息定时器
    const startWebRTCInfoTimer = () => {
      console.log('%c_____启动 WebRTC 信息定时器', 'background:yellow', dataChannelsRef.current.size);

      // 如果已经有定时器在运行，先清除它
      if (webrtcInfoIntervalId.current) {
        clearInterval(webrtcInfoIntervalId.current);
      }

      webrtcInfoIntervalId.current = setInterval(() => {
        sendMessage({
          type: 'webrtcInfo',
          data: JSON.stringify({
            connectedNumber: peerConnections.current.size,
          }),
        });
      }, 5000);
    };

    // 停止 WebRTC 信息定时器
    const stopWebRTCInfoTimer = () => {
      console.log('%c_____停止 WebRTC 信息定时器', 'background:orange');

      if (webrtcInfoIntervalId.current) {
        clearInterval(webrtcInfoIntervalId.current);
        webrtcInfoIntervalId.current = null;
      }
    };

    // 获取当前连接数量
    const getConnectionCount = () => {
      return dataChannelsRef.current.size;
    };

    return {
      set,
      delete: _delete,
      get,
      getAll,
      clear,
      startWebRTCInfoTimer,
      stopWebRTCInfoTimer,
      getConnectionCount
    };
  }, []);

  const dataChannels = useMemo(() => {
    return changeDataChannel();
  }, [changeDataChannel]);

  // 创建数据通道的函数
  const createDataChannel = (peerConnection: RTCPeerConnection, viewerId: string) => {
    const dataChannel = peerConnection.createDataChannel('chat', {
      ordered: true, // 保证消息顺序
      maxRetransmits: 3 // 重传次数
    });


    // dataChannel.addEventListener('open', handleDataChannelOpen);
    // dataChannel.addEventListener('message', handleDataChannelMessage);
    // dataChannel.addEventListener('error', handleDataChannelError);
    // dataChannel.addEventListener('close', handleDataChannelClose);

    // 保存数据通道引用
    dataChannels.set(viewerId, dataChannel);

    return dataChannel;
  };



  // 发送消息函数
  const sendMessage = ({ type, data, targetViewerId }: RTCDataChannelSendMessageProps) => {
    const message = {
      type,
      data,
      from: 'master'
    };

    if (targetViewerId) {
      // 发送给特定观众
      const dataChannel = dataChannels.get(targetViewerId);
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(message));
      }
    } else {
      // 广播给所有观众
      dataChannels.getAll().forEach((dataChannel, viewerId) => {
        if (dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify(message));
        }
      });
    }
  };

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
        const sender = peerConnection.addTrack(track, stream);

        // 设置最大码率
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [];
        }
        parameters.encodings[0].maxBitrate = 2500000;
        sender.setParameters(parameters)
          .then(() => {
            // console.log('设置初始码率成功: 2500000')
          })
          .catch(err => console.error('设置初始码率失败:', err));
      });

      // 处理 ICE candidate
      peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate && sessionIdRef.current) {
          signalingClientV2.current?.deviceSendIceCandidate(JSON.stringify(event.candidate), viewerId, sessionIdRef.current);
        } else {
          console.log(`[MASTER] 观众 ${viewerId} 的 ICE candidate 收集完成`);
        }
      });

      peerConnection.addEventListener('negotiationneeded', async (e) => {
        console.log(`%c_______negotiationneeded 变化`, 'background:yellow', e);
      });

      peerConnection.addEventListener('track', (event) => {
        setAudioDevices(event.streams[0]);
      });

      // 监听连接状态
      peerConnection.addEventListener('connectionstatechange', () => {
        const state = peerConnection.connectionState;
        console.log(`[MASTER] 与观众 ${viewerId} 的连接状态变化:`, state);
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          // console.log(`[MASTER] 与观众 ${viewerId} 的连接已断开`);
          if (dataChannels.get(viewerId)) {
            // const channel = dataChannels.get(viewerId) as RTCDataChannel;
            // removeDataChannelListeners(channel, viewerId);
            dataChannels.delete(viewerId);
          }
          peerConnections.current.delete(viewerId);
        }
        if (state === 'connected') {
          // console.log(`[MASTER] 与观众 ${viewerId} 的连接已建立`);
        }
      });

      // peerConnection.addEventListener('datachannel', () => {
      //   console.log('%c___ datachannel ____', 'background: blue');
      // });

      peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log('%c___ icegatheringstatechange ____', 'background: blue');
      });

      peerConnection.addEventListener('iceconnectionstatechange', () => {
        console.log('%c___ iceconnectionstatechange ____', 'background: blue');
      });

      peerConnection.addEventListener('signalingstatechange', () => {
        console.log('%c___ signalingstatechange ____', 'background: blue');
      });

      createDataChannel(peerConnection, viewerId);

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
        offerToReceiveVideo: true,
      });

      // 在设置本地描述前，修改 SDP
      // offer.sdp = preferCodec(offer.sdp, 'VP9');
      // offer.sdp = preferCodec(offer.sdp, 'H265');

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
        console.log('收到呼叫', data);
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
      InCallManager.start({
        media: 'audio',
        auto: false,  // 禁用自动接近传感器管理
      });
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
      dataChannels.getAll().forEach(channel => {
        if (channel.readyState !== 'closed') {
          channel.close();
        }
        channel.removeEventListener('open', handleDataChannelOpen);
        channel.removeEventListener('message', handleDataChannelMessage);
        channel.removeEventListener('error', handleDataChannelError);
        channel.removeEventListener('close', handleDataChannelClose);
      });
      // 清空数据通道 Map
      dataChannels.clear();
      cleanup();
      InCallManager.stop();
    }

  }, []);

  return (
    <>
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
          </>
        )}
      </View>
      {audioDevices && (
        <>
          <RTCView
            streamURL={audioDevices.toURL()}
            style={styles.audioStream}
            objectFit="cover"
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    position: 'relative', // 确保子元素可以定位在父元素上
  },
  stream: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  audioStream: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
});