import DeviceBtn from '@/components/webrct/device_btn_mqtt';
import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { RTCView } from 'react-native-webrtc';
import { useWebRTC } from "@/lib/rtc/hook";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import VideoPreview from '@/components/webrct/video_preview';

// 定义从服务器获取的 devicesMap 的类型
// 它的结构是 { [deviceId: string]: { [viewerId: string]: boolean } }
type DevicesMap = Record<string, Record<string, boolean>>;

// --- 重要提示：网络配置 ---
// 如果你在 Android 模拟器上运行，请使用 'http://10.0.2.2:8910'
// 如果你在 iOS 模拟器上运行，并且服务器在同一台 Mac 上，可以使用 'http://localhost:8910'
// 如果你在真实物理设备上运行，请将 'localhost' 替换为你电脑的局域网 IP 地址
// (例如 'http://192.168.1.100:8910')
// const SERVER_URL = 'http://192.168.3.65:8910'; // 默认为 Android 模拟器
const SERVER_URL = process.env.EXPO_PUBLIC_Request_URL; // 默认为 Android 模拟器

export default function V4() {
  // 使用 useState 来存储设备列表、加载状态和错误信息
  const [devices, setDevices] = useState<DevicesMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { remoteStream } = useWebRTC();

  // 按钮点击时触发的函数，用于获取设备列表
  const handleFetchDevices = async () => {
    setIsLoading(true); // 开始加载，显示加载指示器
    setError(null); // 清除之前的错误信息

    try {
      const response = await fetch(`${SERVER_URL}/mio/t1`);

      if (!response.ok) {
        // 如果服务器返回非 2xx 的状态码，则抛出错误
        throw new Error(`请求失败，状态码: ${response.status}`);
      }

      const data: DevicesMap = await response.json();
      setDevices(data);
    } catch (e: any) {
      console.error('获取设备列表失败:', e);
      setError('获取设备列表失败，请检查服务器是否正在运行以及网络配置是否正确。');
    } finally {
      setIsLoading(false); // 请求结束，无论成功或失败都停止加载
    }
  };

  const deviceIds = Object.keys(devices);

  const connectToDevice = async (deviceId: string) => {

  }

  const watchVideoOnFullScreen = async () => {
    console.log('lalalallalalalal')
    router.push({
      pathname: '/viewer/fullscreen',
    })
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <></>
        <Text style={styles.title}>V3 - 设备查询</Text>
        <Button title="查询在线设备" onPress={handleFetchDevices} />
        <VideoPreview />
        <RTCView />
        <View style={styles.resultsContainer}>
          {/* 根据加载状态显示不同内容 */}
          {isLoading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : deviceIds.length > 0 ? (
            // 遍历并显示设备列表
            deviceIds.map((deviceId) => {
              return (
                <DeviceBtn deviceId={deviceId} key={deviceId} />
              );
            })
          ) : (
            // 如果没有设备，显示提示信息
            <Text style={styles.infoText}>
              暂无在线设备。点击上方按钮查询。
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f5f5f5',
    height: '100%',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultsContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    minHeight: 100, // 给结果区域一个最小高度
    justifyContent: 'center',
  },
  deviceItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  deviceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  viewerText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  infoText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    color: 'red',
    fontSize: 16,
  },
});