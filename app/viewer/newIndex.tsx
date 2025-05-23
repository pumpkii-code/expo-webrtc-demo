/*
 * @Author: tonyYo
 * @Date: 2025-05-14 14:56:17
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-16 11:50:23
 * @FilePath: /expo-webrtc-demo/app/viewer/index.tsx
 */
import PDRTCView from "@/components/webrct/viewer_v2";
import { useEffect, useRef, useState } from "react"
import { SignalingClientV2 } from '@/lib/signal_v2';
import { newGuid } from "@/lib/util";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SignalingClient } from "@/lib/signal";
import { useRoute } from "@react-navigation/native";
import { RTCIceCandidate } from 'react-native-webrtc';

// const peerId = 'RHZL-00-WTSN-9S3D-00000727';
const viewId = '2222'

export default function ViewerScreen() {
  const { serno: peerId } = (useRoute().params ?? { serno: '' }) as { serno: string };
  const webSocketRef = useRef<SignalingClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [sdp, setSdp] = useState<string>('');
  const [candidate, setCandidate] = useState<string>('');
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration>();


  // 连接信令服务器
  const connectSignaling = (serverUrl: string) => {
    console.log('[VIEWER] 开始连接信令服务器');
    console.log('%c___' + serverUrl, 'color:aqua')
    webSocketRef.current = new SignalingClient(serverUrl);

    webSocketRef.current.connect({
      onConnected: () => {
        setConnected(true);
        console.log('[VIEWER] 连接信令服务器成功');
        webSocketRef.current?.register(viewId);
      },
      onRegistered: () => {
        console.log('[VIEWER] 注册成功');
        console.log('_____peerid', peerId, viewId)
        webSocketRef.current?.connectTo(peerId, viewId);
      },
      onDisconnected: () => {
        setConnected(false);
      },
      onOffer: (description) => {
        // 任务 4  WebRTC iceservers 传递优化
        const iceservers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        setRtcConfig(iceservers);
        setSdp(description.sdp);
      },
      onCandidate: (candidate) => {
        setCandidate(JSON.stringify(candidate));
      }
    });
  };

  useEffect(() => {
    connectSignaling('ws://192.168.3.65:8080');
    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.disconnect();
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
          const newCandidate = JSON.parse(candidate) as RTCIceCandidate;
          webSocketRef.current?.sendCandidate(newCandidate, peerId);
        }}
        onCreateAnswer={(answer) => {
          webSocketRef.current?.sendAnswer(answer.sdp, peerId);
        }}
        // onCreateOffer={(offer) => {
        //   webSocketRef.current?.sendOffer(offer.sdp, offer.type, peerId, sessionIdRef.current);
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