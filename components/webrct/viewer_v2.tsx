import { useEffect, useRef, useState } from "react"
import { SignalingClientV2 } from '@/lib/signal_v2';
import { newGuid } from "@/lib/util";
import { View, Text, StyleSheet } from "react-native";
import { RTCPeerConnection, RTCSessionDescription, RTCView, MediaStream, RTCIceCandidate } from 'react-native-webrtc';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel.d.ts';
import type MessageEvent from 'react-native-webrtc/lib/typescript/MessageEvent.d.ts';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent.d.ts'

export default function TestComponent({ wsurl }: { wsurl: string }) {
  const signalingClientV2 = useRef<SignalingClientV2 | null>(null);
  const webrtcClient = useRef<RTCPeerConnection | null>(null);
  // const rtcDataChannel = useRef<RTCDataChannel | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [rtcDataChannel, setRtcDataChannel] = useState<RTCDataChannel>();
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | undefined>('new');


  useEffect(() => {
    if (!rtcDataChannel) return;

    const onMessage = (event: MessageEvent<"message">) => {
      console.log(' recvDC received: ', rtcDataChannel?.id, 'data:', event);
    }

    const onOpen = () => {
      console.log(
        'recvDC datachannel open',
        rtcDataChannel?.id,
        rtcDataChannel?.label
      );
    }

    const onClose = () => {
      console.log('recvDC datachannel close', rtcDataChannel?.id);
    }

    rtcDataChannel?.addEventListener('message', onMessage);
    rtcDataChannel?.addEventListener('open', onOpen);
    rtcDataChannel?.addEventListener('close', onClose);

    return () => {
      rtcDataChannel?.removeEventListener("message", onMessage)
      rtcDataChannel?.removeEventListener("open", onOpen)
      rtcDataChannel?.removeEventListener("close", onClose)
    }

  }, [rtcDataChannel]);

  const handleOnTrack = (e: RTCTrackEvent<"track">) => {
    console.log('%c_____7.4___ 收到 track 事件', 'background-color: black; color: white', e.streams[0]);
    const stream = e.streams[0];
    setVideoStream(stream);
  }

  const connectSignaling = (serverUrl: string) => {
    console.log('[VIEWER] 开始连接信令服务器');
    signalingClientV2.current = new SignalingClientV2(serverUrl, newGuid());

    const peerId = 'RHZL-00-WTSN-9S3D-00000727';
    const sessionId = newGuid();
    const source = 'MainStream';
    const audioEnable = 'recvonly';
    const videoEnable = 'recvonly';
    const connectmode = 'live';
    const user = 'root';
    const pwd = '123456';
    const datachannelEnable = true;

    const initWebrtcClient = (iceservers: RTCConfiguration) => {
      webrtcClient.current = new RTCPeerConnection({
        iceServers: iceservers.iceServers,
      });

      try {
        webrtcClient.current?.addEventListener('track', handleOnTrack);

        webrtcClient.current?.addEventListener('datachannel', (ev) => {
          console.log('%c_____8 收到 datachannel 事件', 'background-color: black; color: white', ev);
          setRtcDataChannel(ev.channel)
        });

        webrtcClient.current?.addEventListener('icecandidate', (event) => {
          console.log('%c___6 收到 icecandidate 事件', 'color:lightblue', event, event.candidate);
          if (event.candidate) {
            const candidate = JSON.stringify(event.candidate);
            signalingClientV2.current?.sendIceCandidate(candidate, peerId, sessionId);
          }
        });

        webrtcClient.current?.addEventListener('connectionstatechange', (event) => {
          console.log('%c_____7.5____ 收到 connectionstatechange 事件', 'background-color: black; color: yellow', event);
          const newState = webrtcClient.current?.connectionState;
          console.log(`Connection state changed: ${newState}`);
          setConnectionState(newState);
          if (newState === 'failed') {
            setError(`WebRTC connection failed.`);
            // 可以在这里触发重连逻辑，或者让使用方处理
            // cleanupWebRTC(); // 如果连接失败，清理资源
          } else if (newState === 'disconnected') {
            console.warn(`WebRTC connection disconnected. May recover or may need reconnection.`);
            // 'disconnected' 状态有时可以自动恢复，但如果长时间停留，也视为失败
          } else if (newState === 'closed') {
            console.log(`WebRTC connection closed.`);
            // cleanupWebRTC(); // 确保资源在关闭时被清理
          } else {
            setError(null); // 清除旧的错误
          }
        });

        webrtcClient.current?.addEventListener('iceconnectionstatechange', (event) => {
          console.log('%c_____7.1___ 收到 iceconnectionstatechange 事件',
            'background-color: aqua; color: white',
            webrtcClient.current?.connectionState
          );
        });

        webrtcClient.current?.addEventListener('icegatheringstatechange', (event) => {
          console.log('%c_____7.2___ 收到 icegatheringstatechange 事件', 'background-color: black; color: white', event);
        });

        webrtcClient.current?.addEventListener('signalingstatechange', (event) => {
          console.log('%c_____7.3___ 收到 signalingstatechange 事件', 'background-color: black; color: white', event);
        });

      } catch (error) {
        setError(` Failed to initialize WebRTC)`);
        console.error('Failed to initialize WebRTC', error);
        setConnectionState('closed'); // 更新状态
        return false;
      }
    }

    signalingClientV2.current?.connect({
      onConnected: () => {
        setConnected(true);
        setError(null);
        signalingClientV2.current?.initiateSession(peerId, sessionId);
      },
      onCreate: (data) => {
        console.log('___3 收到 onCreate 事件', data);
        const options = {
          audioEnable,
          videoEnable,
          iceServers: data.iceServers,
          user,
          pwd,
          datachannelEnable
        };
        signalingClientV2.current?.sendCall(peerId, sessionId, connectmode, source, options);
      },
      onOffer: async (data) => {
        const iceservers = JSON.parse(data.iceservers) as RTCConfiguration;
        console.log('___4__ 收到 onOffer 事件', data);
        initWebrtcClient(iceservers);

        await webrtcClient.current?.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));

        await webrtcClient.current?.createAnswer().then((answer) => {
          console.log('___5 创建 answer');
          webrtcClient.current?.setLocalDescription(answer);
          signalingClientV2.current?.sendAnswer(answer.sdp, answer.type, peerId, sessionId);
        });

        console.log('_____A1___ 初始化 webrtcClient', webrtcClient.current?.connectionState);
        setConnectionState(webrtcClient.current?.connectionState); // 初始化状态

        // await webrtcClient.current.createOffer({}).then((offer) => {
        //   console.log('___5 创建 offer');
        //   signalingClientV2.current?.sendAnswer(offer.sdp, offer.type, peerId, sessionId);
        //   return webrtcClient.current?.setLocalDescription(offer);
        // })
      },
      onCandidate: (data) => {
        console.log('___1000_1 收到 onCandidate 事件', data);
        const newData = JSON.parse(data.candidate);
        const candidate = new RTCIceCandidate({
          sdpMLineIndex: newData.sdpMLineIndex,
          candidate: newData.candidate,
        });
        webrtcClient.current?.addIceCandidate(JSON.parse(data.candidate));
      },
      onDisconnected: () => {
        setConnected(false);
      }
    })
  }

  useEffect(() => {
    connectSignaling(wsurl);

    return () => {
      if (signalingClientV2.current) {
        signalingClientV2.current.disconnect();
      }

      if (webrtcClient.current) {
        webrtcClient.current.close();
      }
    };
  }, [])

  return (
    <View style={styles.container}>
      {/* <Text>正在播放....{"connectionState: " + connectionState} </Text> */}
      {error && (connectionState === 'connected') && (
        <Text style={styles.error}>{error}</Text>
      )}
      {!connected && !error && (
        <Text style={styles.offlineText}>正在连接服务器...</Text>
      )}
      {connectionState === 'disconnected' && (
        <Text style={styles.offlineText}>设备断开连接</Text>
      )}

      {connected && !videoStream && !error && (
        <Text>等待主播端开始推流...</Text>
      )}
      {videoStream
        // && connectionState === 'connected' 
        && (
          <>
            <RTCView
              streamURL={videoStream.toURL()}
              style={styles.stream}
              objectFit="contain"
            />
          </>
        )
      }
      {!videoStream && (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineText}>设备还未连接</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stream: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  offlineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  offlineText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});