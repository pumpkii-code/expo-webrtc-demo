import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator, Button } from "react-native";
import { RTCPeerConnection, RTCView, MediaStream, RTCSessionDescription, MediaStreamTrack, mediaDevices } from 'react-native-webrtc';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel.d.ts';
import type MessageEvent from 'react-native-webrtc/lib/typescript/MessageEvent.d.ts';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent.d.ts'
import type RTCDataChannelEvent from 'react-native-webrtc/lib/typescript/RTCDataChannelEvent.d.ts'
import type RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent.d.ts'
import InCallManager from 'react-native-incall-manager';
import AudioButton from "../menu/audio-button";
interface ITestComponentProps {
  rtcConfig: RTCConfiguration;
  sdp: string;
  candidate: string;
  onIcecandidate: (candidate: string) => void;
  onCreateAnswer: (answer: { sdp: string; type: RTCSdpType }) => void;
  // onCreateOffer: (offer: { sdp: string; type: RTCSdpType }) => void;
  // onCreateOffer: (offer: { sdp: string; type: string }) => void;
}


export default function PDRTCView({ rtcConfig, sdp, candidate, onIcecandidate, onCreateAnswer
  // onCreateOffer
}: ITestComponentProps) {
  // const signalingClientV2 = useRef<SignalingClientV2 | null>(null);
  const webrtcClient = useRef<RTCPeerConnection | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream>(audioStream);
  audioStreamRef.current = audioStream;
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream>(videoStream);
  videoStreamRef.current = videoStream;
  const [rtcDataChannel, setRtcDataChannel] = useState<RTCDataChannel>();
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | undefined>('new');
  const audioTrackRef = useRef<MediaStreamTrack[] | null>(null);
  const [enableAudio, setEnableAudio] = useState<boolean>(false);

  const getClientAudio = async () => {
    console.log('%c_____9.2___ 尝试添加音频', 'background-color: black; color: white');
    try {
      const audioStream = await mediaDevices.getUserMedia({
        audio: true,
        // video: {
        //   facingMode: 'user',
        //   width: { ideal: 1280 },
        //   height: { ideal: 720 },
        // }
        video: false
      });
      console.log('%c_____9.3___ 尝试添加音频', 'background-color: black; color: white', audioStream);
      setAudioStream(audioStream)
      return audioStream;
    } catch (error) {
      console.error('麦克风获取失败:', error);
    }
  };

  const tryAddAudio = async () => {
    console.log('%c_____9.1___ 尝试添加音频', 'background-color: black; color: white');
    const audioStream = await getClientAudio();
    console.log('%c_____9.4___ 尝试添加音频', 'background-color: black; color: white', audioStream, webrtcClient.current);
    if (audioStream && webrtcClient.current) {
      console.log('%c_____9.5___ before add track', 'background-color: black; color: white');
      audioTrackRef.current = audioStream.getAudioTracks();
      audioTrackRef.current.forEach(track => {
        track.enabled = false;
        console.log('%c_____9.5___ after add track', 'background-color: black; color: yellow');
        webrtcClient.current?.addTrack(track, audioStream);
        console.log('%c_____9.6___ after add track', 'background-color: black; color: yellow');
      });
    }
  };

  const handleScreenshot = () => {
    console.log('handleScreenshot');
  }
  const handleRecord = () => {
    audioTrackRef.current?.forEach(track => {
      track.enabled = !enableAudio;
      console.log('handleRecord', track.enabled);
    })
    setEnableAudio(!enableAudio)
    console.log('handleRecord');
  }

  const handleOnTrack = (e: RTCTrackEvent<"track">) => {
    console.log('%c_____7.4___ 收到 track 事件', 'background-color: black; color: white', e.streams[0]);
    const stream = e.streams[0];
    setVideoStream(stream);
  }

  const handelDataChannel = (dataChannel: RTCDataChannelEvent<"datachannel">) => {
    console.log('%c_____8 收到 datachannel 事件', 'background-color: black; color: white', dataChannel);
    setRtcDataChannel(dataChannel.channel)
  }

  const handleIceCandidate = (event: RTCIceCandidateEvent<"icecandidate">) => {
    console.log('%c___6 收到 icecandidate 事件', 'color:lightblue', event, event.candidate);
    if (event.candidate) {
      const candidate = JSON.stringify(event.candidate);
      onIcecandidate(candidate)
    }
  }

  const handleConnectionStateChange = () => {
    console.log('%c_____7.5____ 收到 connectionstatechange 事件', 'background-color: black; color: yellow');
    const newState = webrtcClient.current?.connectionState;
    console.log(`Connection state changed: ${newState}`);
    setConnectionState(newState);
    if (newState === 'connected') {
      console.log(`____WebRTC connection established.`);

    } else if (newState === 'failed') {
      setError(`WebRTC connection failed.`);
      // 可以在这里触发重连逻辑，或者让使用方处理
      // cleanupWebRTC(); // 如果连接失败，清理资源    } else if (newState === 'disconnected') {
      console.warn(`WebRTC connection disconnected. May recover or may need reconnection.`);
      // 'disconnected' 状态有时可以自动恢复，但如果长时间停留，也视为失败
    } else if (newState === 'closed') {
      console.log(`WebRTC connection closed.`);
      // cleanupWebRTC(); // 确保资源在关闭时被清理
    } else {
      setError(null); // 清除旧的错误
    }
  }

  const handleIceconnectionstatechange = () => {
    console.log('%c_____7.1___ 收到 iceconnectionstatechange 事件',
      'background-color: aqua; color: white',
      webrtcClient.current?.connectionState
    );
  }

  const handleIcegatheringstatechange = () => {
    console.log('%c_____7.2___ 收到 icegatheringstatechange 事件', 'background-color: black; color: white');
  }

  const handleSignalingstatechange = () => {
    console.log('%c_____7.3___ 收到 signalingstatechange 事件', 'background-color: black; color: white');
  }

  const initWebrtcClient = async (iceservers: RTCConfiguration) => {
    webrtcClient.current = new RTCPeerConnection({
      iceServers: iceservers.iceServers,
    });
    tryAddAudio();
    try {
      webrtcClient.current?.addEventListener('track', handleOnTrack);
      webrtcClient.current?.addEventListener('datachannel', handelDataChannel);
      webrtcClient.current?.addEventListener('icecandidate', handleIceCandidate);
      webrtcClient.current?.addEventListener('signalingstatechange', handleSignalingstatechange);
      webrtcClient.current?.addEventListener('connectionstatechange', handleConnectionStateChange);
      webrtcClient.current?.addEventListener('icegatheringstatechange', handleIcegatheringstatechange);
      webrtcClient.current?.addEventListener('iceconnectionstatechange', handleIceconnectionstatechange);

    } catch (error) {
      setError(` Failed to initialize WebRTC)`);
      console.error('Failed to initialize WebRTC', error);
      setConnectionState('closed'); // 更新状态
      return false;
    }
  }

  const initWebrtcClientAsync = async () => {
    console.log('___initWebrtcClientAsync____', sdp)
    await webrtcClient.current?.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdp }));

    // await webrtcClient.current?.createOffer({
    //   offerToReceiveAudio: true,
    //   offerToReceiveVideo: true
    // }).then((offer) => {
    //   console.log('___5______client__:D 创建 offer');
    //   webrtcClient.current?.setLocalDescription(offer);
    //   onCreateOffer(offer);
    // });

    await webrtcClient.current?.createAnswer().then((answer) => {
      console.log('___5 创建 answer');
      webrtcClient.current?.setLocalDescription(answer);
      onCreateAnswer(answer);
    });

    console.log('_____A1___ 初始化 webrtcClient', webrtcClient.current?.connectionState);
    setConnectionState(webrtcClient.current?.connectionState); // 初始化状态
  }

  useEffect(() => {
    if (!candidate) return;
    console.log('_____A2___ 收到 addIceCandidate', candidate);
    webrtcClient.current?.addIceCandidate(JSON.parse(candidate));
  }, [candidate])

  useEffect(() => {
    setError(null);
    initWebrtcClient(rtcConfig);
    initWebrtcClientAsync();

    return () => {
      if (webrtcClient.current) {
        webrtcClient.current.removeEventListener('track', handleOnTrack);
        webrtcClient.current.removeEventListener('datachannel', handelDataChannel);
        webrtcClient.current.removeEventListener('icecandidate', handleIceCandidate);
        webrtcClient.current.removeEventListener('signalingstatechange', handleSignalingstatechange);
        webrtcClient.current.removeEventListener('connectionstatechange', handleConnectionStateChange);
        webrtcClient.current.removeEventListener('icegatheringstatechange', handleIcegatheringstatechange);
        webrtcClient.current.removeEventListener('iceconnectionstatechange', handleIceconnectionstatechange);
        webrtcClient.current.close();
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.release();
      }
    };

  }, [rtcConfig])


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

  useEffect(() => {
    try {
      InCallManager.start({ media: 'audio' });
      InCallManager.setForceSpeakerphoneOn(true);
      console.log('扬声器已打开 (手动测试)');
    } catch (e) {
      console.error('手动测试扬声器失败:', e);
    }

    return () => {
      InCallManager.stop();
    }
  }, [])

  const getStatusMessage = () => {
    if (error && connectionState === 'connected') {
      return <Text style={styles.error}>{error}</Text>;
    }
    if (connectionState === 'disconnected') {
      return <Text style={styles.offlineText}>WebRTC 连接已断开</Text>;
    }
    if (connectionState === 'connecting' || connectionState === 'new') {
      return <Text style={styles.offlineText}>正在建立 WebRTC 连接...</Text>;
    }
    if (!videoStream && !error && connectionState === 'connected') {
      return <Text style={styles.offlineText}>等待主播开始推流...</Text>;
    }
    if (!videoStream) {
      return (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineText}>设备未连接</Text>
        </View>
      );
    }
    return null;
  };

  // 完全准备完毕
  if (videoStream && connectionState === 'connected' && !error) {
    return (
      <>
        <View style={styles.viewContainer}>
          <RTCView
            streamURL={videoStream.toURL()}
            style={styles.stream}
            objectFit="contain"
          />
          {/* 绝对定位按钮区域 */}
          <View style={styles.buttonContainer}>
            <View style={styles.buttonRow}>
              <Button title="截屏" onPress={handleScreenshot} color="#fff" />
              <Button title="录屏" onPress={handleRecord} color="#fff" />
              <AudioButton audioTrack={audioTrackRef.current} />
            </View>
          </View>
        </View>
      </>
    );
  } else {
    return (
      <>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            {getStatusMessage()}
          </Text>
        </View>
      </>
    )
  }
}

const styles = StyleSheet.create({
  viewContainer: {
    display: 'flex',
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999'
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
  buttonContainer: {
    position: 'absolute',
    left: 20,
    bottom: 40,
    zIndex: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
});