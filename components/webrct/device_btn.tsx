import { SignalingClientV2 } from "@/lib/signal_v2";
import { newGuid } from "@/lib/util";
import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { useWebRTC } from "@/lib/rtc/hook";
import { RTCPeerConnection, RTCView, MediaStream, RTCSessionDescription, MediaStreamTrack } from 'react-native-webrtc';
import { CreateEventData, OfferReceverData } from "@/types/signal_v3";
import { SignalingClientV3 } from "@/lib/websocket/SignalingClientV3";
import type { State, RTCConectionState } from '@/lib/rtc/single';

interface DeviceBtnProps {
  deviceId: string;
}
const user = 'root';
const pwd = '123456';

const wsUrl = process.env.EXPO_PUBLIC_WS_URL;

export default function DeviceBtn({ deviceId }: DeviceBtnProps) {
  const viewerId = useRef<string>(newGuid());
  const wsRef = useRef<SignalingClientV3>(new SignalingClientV3(wsUrl, viewerId.current));

  const sessionIdRef = useRef(newGuid());
  const [rtcConnectState, setRtcConnectState] = React.useState<RTCConectionState | null>('closed');
  const { startCall, setRTCId, rtcId, setWsRef, hangUp, connectionState } = useWebRTC();

  useEffect(() => {
    if (rtcId === deviceId) {
      setRtcConnectState(connectionState);
    } else {
      setRtcConnectState('closed');
    }
  }, [rtcId, connectionState])

  const connectRTC = useCallback(() => {
    if (rtcId && rtcId !== deviceId) {
      hangUp();
    } else {
      console.error('设备已连接，请勿重复连接__1');
      return;
    }

    setRtcConnectState('connecting');
    setRTCId(deviceId);
    setWsRef(wsRef.current);

    wsRef.current?.initiateSession(deviceId, sessionIdRef.current);
  }, [rtcConnectState, rtcId])

  const handleConnected = () => {
    wsRef.current?.registerViewerId(viewerId.current);
  }

  const handleCreate = (data: CreateEventData) => {
    console.log('_____onCreate____')
    const options = {
      iceServers: data.iceServers,
      user,
      pwd,
    } as const;
    wsRef.current?.sendCall(deviceId, viewerId.current, options);

    if (wsRef.current) {
      console.log(wsRef)
    } else {
      console.error('ws.current is null');
    }
  }

  const handleOffer = (data: OfferReceverData) => {
    console.log('%c_____onOffer____', 'background:yellow', { data })
    const iceservers = JSON.parse(data.iceservers) as RTCConfiguration;
    startCall(iceservers, data.sdp)
  };

  const handleDisconnected = (reason: string) => {
    console.log('信令连接断开:', reason);
    // 在此处理重连逻辑或UI更新
  };

  const handleError = (error: any) => {
    console.error("信令客户端出错:", error);
  }

  useEffect(() => {
    // 这个 log 应该会在 Metro Bundler 的终端或者浏览器的开发者工具中显示
    console.log('_____connectRTC 被触发了！当前设备的 id 是：', deviceId);

    wsRef.current?.on('connected', handleConnected);
    wsRef.current?.on('create', handleCreate);
    wsRef.current?.on('offer', handleOffer);
    wsRef.current?.on('disconnected', handleDisconnected);
    wsRef.current?.on('error', handleError);
    wsRef.current?.connect().catch(err => {
      // 初始连接失败会在这里捕获
      console.error("无法连接到信令服务器:", err);
    });

    return () => {
      wsRef.current?.off('connected', handleConnected);
      wsRef.current?.off('create', handleCreate);
      wsRef.current?.off('offer', handleOffer);
      wsRef.current?.off('disconnected', handleDisconnected);
      wsRef.current?.off('error', handleError);
      wsRef.current?.disconnect();
    }
  }, []);

  return (
    // 使用一个 View 包裹，并给 Pressable 添加明确的样式
    <View style={styles.container}>
      <Pressable
        onPress={connectRTC}
        style={styles.pressable}
      >
        <Text style={styles.text}>设备 ID: {deviceId} {rtcConnectState}</Text>
        <View><Text style={styles.text}>按钮 ID: {viewerId.current} </Text></View>
        <View><Text style={styles.text}>state:__{connectionState} </Text></View>
        {/* {remoteStream && <RTCView
          streamURL={remoteStream.toURL()}
          style={{ width: 200, height: 200 }}
          objectFit="contain"
        />} */}
      </Pressable>
    </View>
  );
}

// 添加样式表进行调试
const styles = StyleSheet.create({
  container: {
    // 给容器一些边距，确保它不会被屏幕边缘切掉
    margin: 10,
  },
  pressable: {
    backgroundColor: 'red', // 添加一个鲜艳的背景色，看它是否显示
    paddingHorizontal: 20,     // 添加水平内边距，撑大点击区域
    paddingVertical: 10,       // 添加垂直内边距
    borderRadius: 8,           // 美化一下
  },
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  }
});