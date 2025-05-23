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


// const peerId = 'RHZL-00-WTSN-9S3D-00000727';
const peerId = 'RHZL-00-IFJF-779N-00000244';
const wsUrl = 'ws://webrtc.qq-kan.com/';

export default function ViewerScreen() {
  // const [peerId, setUsePeerId] = useState<string>('');
  const signalingClientV2 = useRef<SignalingClientV2 | null>(null);
  const [connected, setConnected] = useState(false);
  // const webrtcClient = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef(newGuid());
  const [sdp, setSdp] = useState<string>('');
  const [candidate, setCandidate] = useState<string>('');

  // const [isOfferReady,setiIsOfferReady] = useState(false);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration>();

  const connectSignaling = (serverUrl: string) => {
    console.log('[VIEWER] 开始连接信令服务器');
    signalingClientV2.current = new SignalingClientV2(serverUrl, newGuid());

    // const peerId = 'RHZL-00-WTSN-9S3D-00000727';
    const source = 'MainStream';
    const audioEnable = 'recvonly';
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
        signalingClientV2.current?.sendCall(peerId, sessionIdRef.current, connectmode, source, options);
      },
      onOffer: async (data) => {
        const iceservers = JSON.parse(data.iceservers) as RTCConfiguration;
        // initWebrtcClient(iceservers);

        setRtcConfig(iceservers);
        setSdp(data.sdp);
      },
      onCandidate: (data) => {
        console.log('___1000_1 收到 onCandidate 事件', data);
        setCandidate(data.candidate);
      },
      onDisconnected: () => {
        setConnected(false);
      }
    });
  }

  useEffect(() => {

  }, []);


  useEffect(() => {
    connectSignaling(wsUrl);
    return () => {
      if (signalingClientV2.current) {
        signalingClientV2.current.disconnect();
      }
    };
  }, [])




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
      <PDRTCView
        onIcecandidate={(candidate) => {
          signalingClientV2.current?.sendIceCandidate(candidate, peerId, sessionIdRef.current);
        }}
        onCreateAnswer={(answer) => {
          signalingClientV2.current?.sendAnswer(answer.sdp, answer.type, peerId, sessionIdRef.current);
        }}
        // onCreateOffer={(offer) => {
        //   signalingClientV2.current?.sendOffer(offer.sdp, offer.type, peerId, sessionIdRef.current);
        // }}
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