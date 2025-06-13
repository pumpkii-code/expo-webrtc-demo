import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
// 导入我们新的 MqttSignalingClient
import { MqttSignalingClient } from "@/lib/mqtt/MqttSignalingClient";
import { useWebRTC } from "@/lib/rtc/hook";
import { newGuid } from "@/lib/util";
import type { CreateEventData, OfferReceverData } from "@/types/signal_v3";
import type { RTCConectionState } from '@/lib/rtc/single';

interface DeviceBtnProps {
  deviceId: string;
}

const user = 'root';
const pwd = '123456';

// 从环境变量中获取 MQTT Broker 的 URL
// 请确保在你的 .env 文件中设置了 EXPO_PUBLIC_MQTT_URL
// 例如: EXPO_PUBLIC_MQTT_URL=ws://your-mqtt-broker-address:9001
const mqttBrokerUrl = process.env.EXPO_PUBLIC_MQTT_URL;

export default function DeviceBtn({ deviceId }: DeviceBtnProps) {
  // viewerId 现在是这个组件实例在 MQTT 网络中的唯一身份标识
  const viewerId = useRef<string>(newGuid());

  // --- 核心改动: 实例化 MqttSignalingClient ---
  // 不再使用 SignalingClientV3，而是用 MqttSignalingClient
  // 传入 MQTT Broker URL 和 当前客户端的唯一ID (viewerId)
  const mqttClientRef = useRef<MqttSignalingClient>(
    new MqttSignalingClient(mqttBrokerUrl, viewerId.current)
  );

  const sessionIdRef = useRef(newGuid());
  const [rtcConnectState, setRtcConnectState] = useState<RTCConectionState | null>('closed');

  // useWebRTC hook 的接口保持不变
  // 注意：我们将 mqttClientRef.current 传递给 setWsRef
  const { startCall, setRTCId, rtcId, setWsRef, hangUp, connectionState } = useWebRTC();

  useEffect(() => {
    if (rtcId === deviceId) {
      setRtcConnectState(connectionState);
    } else {
      setRtcConnectState('closed');
    }
  }, [rtcId, connectionState, deviceId]);

  const connectRTC = useCallback(() => {
    // 逻辑保持不变
    if (rtcId && rtcId !== deviceId && rtcConnectState !== 'closed') {
      console.log(`[DeviceBtn] Hanging up existing call with ${rtcId} before connecting to ${deviceId}`);
      hangUp();
    } else if (rtcId === deviceId && rtcConnectState !== 'closed') {
      console.error(`[DeviceBtn] Already connected or connecting to ${deviceId}. State: ${rtcConnectState}`);
      return;
    }

    setRtcConnectState('connecting');
    setRTCId(deviceId);

    // --- 核心改动: 将 MQTT 客户端实例传递给 WebRTC Hook ---
    setWsRef(mqttClientRef.current);

    // 发起会话的调用也保持不变
    mqttClientRef.current?.initiateSession(deviceId, sessionIdRef.current);
  }, [deviceId, rtcId, hangUp, setRTCId, setWsRef, rtcConnectState]);


  // --- 事件处理函数 (完全保持不变) ---
  // 因为 MqttSignalingClient 提供了与原先完全一致的事件接口，
  // 所以这里的业务逻辑不需要任何修改。

  // handleConnected 不再需要，因为注册逻辑在 MqttSignalingClient 内部自动处理
  // public registerViewerId 方法也已被废弃。
  // const handleConnected = () => {
  //   // 这个方法在 MQTT 版本中不再需要，可以移除
  //   // mqttClientRef.current?.registerViewerId(viewerId.current); // 这行调用已无意义
  // }

  const handleCreate = (data: CreateEventData) => {
    console.log('[DeviceBtn] Received _create event, sending __call...');
    const options = {
      iceServers: data.iceServers,
      user,
      pwd,
    } as const;
    // 注意：sendCall 的第三个参数是 sessionId，这里我们用 viewerId.current
    // 这与您原始代码的行为一致。如果服务器逻辑需要会话ID，应传入 sessionIdRef.current
    mqttClientRef.current?.sendCall(deviceId, viewerId.current, options);
  }

  const handleOffer = (data: OfferReceverData) => {
    console.log('%c[DeviceBtn] Received _offer event, starting WebRTC call...', 'background:yellow', { data });
    const iceservers = JSON.parse(data.iceservers) as RTCConfiguration;
    startCall(iceservers, data.sdp);
  };

  const handleDisconnected = (reason: string) => {
    console.log(`[DeviceBtn] Signaling connection disconnected:`, reason);
    // 可以在这里处理UI状态，例如设置 rtcConnectState 为 'disconnected'
    setRtcConnectState('closed');
  };

  const handleError = (error: any) => {
    console.error("[DeviceBtn] Signaling client error:", error);
    // 可以在这里处理UI状态，例如设置 rtcConnectState 为 'failed'
    setRtcConnectState('failed');
  }

  // --- useEffect (生命周期钩子) ---
  useEffect(() => {
    console.log(`[DeviceBtn] Component mounted for deviceId: ${deviceId}`);
    const client = mqttClientRef.current;

    // 注册事件监听器
    // 注意: 不再有 'connected' 事件的特定处理逻辑 (handleConnected)
    // client.on('connected', handleConnected); // 移除这行
    client.on('create', handleCreate);
    client.on('offer', handleOffer);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);

    // 连接到 MQTT Broker
    client.connect().catch((err: Error) => {
      console.error(`[DeviceBtn] Failed to connect to MQTT broker:`, err);
      setRtcConnectState('failed');
    });

    // 组件卸载时的清理函数
    return () => {
      console.log(`[DeviceBtn] Component unmounting for deviceId: ${deviceId}`);
      // 移除事件监听器
      // client.off('connected', handleConnected); // 移除这行
      client.off('create', handleCreate);
      client.off('offer', handleOffer);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);

      // 断开 MQTT 连接
      client.disconnect();
    }
  }, [deviceId]); // 依赖项中只有 deviceId，因为其他都是 ref 或稳定的函数

  return (
    <View style={styles.container}>
      <Pressable
        onPress={connectRTC}
        style={({ pressed }) => [
          styles.pressable,
          { backgroundColor: rtcConnectState === 'connected' ? 'green' : (rtcConnectState === 'connecting' ? 'orange' : 'red') },
          pressed && styles.pressed
        ]}
        disabled={rtcConnectState === 'connecting'}
      >
        <Text style={styles.text}>设备 ID: {deviceId}</Text>
        <Text style={styles.text}>状态: {rtcConnectState}</Text>
        {/* <Text style={styles.text}>Viewer ID: {viewerId.current.substring(0, 8)}</Text> */}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 10,
  },
  pressable: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    opacity: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  }
});