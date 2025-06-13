/*
 * @Author: tonyYo
 * @Date: 2025-05-14 14:56:17
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-16 11:50:23
 * @FilePath: /expo-webrtc-demo/app/viewer/index.tsx
 */
import PDRTCView from "@/components/webrct/viewer_v2";
import { useRoute } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react"
import { SignalingClientV2 } from '@/lib/signal_v2';
import { newGuid } from "@/lib/util";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { analyzeSdpForCodecs } from "@/lib/analyzeSdpForCodecs";


// const peerId = 'RHZL-00-WTSN-9S3D-00000727';
// const peerId = 'RHZL-00-IFJF-779N-00000244';
// const wsUrl = 'ws://webrtc.qq-kan.com/';
const peerId = '111';
const wsUrl = 'ws://192.168.3.65:8910';

export default function ViewerScreen() {
  // const [peerId, setUsePeerId] = useState<string>('');
  const signalingClientV2 = useRef<SignalingClientV2 | null>(null);
  const [connected, setConnected] = useState(false);
  // const webrtcClient = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef(newGuid());
  const viewerId = useRef(newGuid());
  const [sdp, setSdp] = useState<string>('');
  const [candidate, setCandidate] = useState<string>('');

  // const [isOfferReady,setiIsOfferReady] = useState(false);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration>();

  useEffect(() => {
    console.log('%c________ sessionIdRef.current', 'background:yellow', viewerId.current)
  }, [viewerId.current]);

  const connectSignaling = (serverUrl: string) => {
    console.log('[VIEWER] 开始连接信令服务器');
    signalingClientV2.current = new SignalingClientV2(serverUrl, viewerId.current);

    // const peerId = 'RHZL-00-WTSN-9S3D-00000727';
    const source = 'MainStream';
    const audioEnable = 'recvonly'; // sendRecv(发送和接收) sendonly(只发送) recvonly(只接收) inactive(不接收也不发送)
    const videoEnable = 'recvonly';
    const connectmode = 'live';
    const user = 'root';
    const pwd = '123456';
    const datachannelEnable = true;

    signalingClientV2.current?.connect({
      onConnected: () => {
        setConnected(true);
        signalingClientV2.current?.initiateSession(peerId, sessionIdRef.current);
      },
      onCreate: (data) => {
        const options = {
          audioEnable,
          videoEnable,
          iceServers: data.iceServers,
          user,
          pwd,
          datachannelEnable
        } as const;
        signalingClientV2.current?.sendCall(peerId, sessionIdRef.current, options);
      },
      onOffer: async (data) => {
        console.log('%c_____onOffer____', 'background:yellow', data)
        const iceservers = JSON.parse(data.iceservers) as RTCConfiguration;
        // initWebrtcClient(iceservers);

        setRtcConfig(iceservers);
        setSdp(data.sdp);
        const supportedCodecs = analyzeSdpForCodecs(data.sdp);

        console.log('%c_____Supported H.264/H.265 Codecs:', 'background: aqua', { supportedCodecs, sdp: data.sdp });
      },
      onDeviceIceCandidate: (data) => {
        console.log('___1000_1 收到 onCandidate 事件', data);
        setCandidate(data.candidate);
      },
      onDisconnected: () => {
        setConnected(false);
      }
    });
  }

  useEffect(() => {
    connectSignaling(wsUrl);
    return () => {
      if (signalingClientV2.current) {
        signalingClientV2.current.disconnect();
      }
    };
  }, []);

  if (!rtcConfig || !connected) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>正在连接websocket服务...</Text>
      </View>
    );
  }

  // 处理涉及到socket 状态以及报错的UI

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <PDRTCView
        onIcecandidate={(candidate) => {
          signalingClientV2.current?.clientSendIceCandidate(candidate);
        }}
        onCreateAnswer={(answer) => {
          signalingClientV2.current?.sendAnswer(answer.sdp, answer.type);
        }}
        sendChangeBitrate={(bitrate) => {
          console.log('___1000_1 收到 onChangeBitrate 事件', bitrate);
          signalingClientV2.current?.sendChangeBitrate(bitrate, peerId, sessionIdRef.current);
        }}
        // onCreateOffer={(offer) => {
        //   const sendData = {
        //     sdp: offer.sdp,
        //     peerId: peerId,
        //     sessionId: sessionIdRef.current,
        //     state: 'successed'
        //   }
        //   signalingClientV2.current?.sendOffer(sendData);
        // }}
        viewerId={viewerId.current}
        candidate={candidate}
        rtcConfig={rtcConfig}
        sdp={sdp}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
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
  }
});