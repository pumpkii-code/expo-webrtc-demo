import { useWebRTC } from "@/lib/rtc/hook";
import { useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Button, Platform, Alert } from "react-native";
import { RTCPeerConnection, RTCView, MediaStream, RTCSessionDescription, MediaStreamTrack } from 'react-native-webrtc';
import ViewShot, { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';

export default function FullScreen() {
  const { remoteStream } = useWebRTC();

  // 截屏相关状态和
  const [isTakingShot, setIsTakingShot] = useState(false);
  // 新增状态用于存储截图的 ViewShot 实例
  const viewShotRef = useRef<ViewShot>(null);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);

  const takeScreenshotAndSave = async () => {
    if (isTakingShot || !viewShotRef.current) {
      return;
    }
    setIsTakingShot(true);
    setScreenshotUri(null); // 清除旧截图

    try {
      console.log("开始捕获...");
      const uri = await captureRef(viewShotRef, {
        format: 'jpg',   // 保存格式 (jpg 或 png)
        quality: 0.9,    // 图片质量 (0.0 - 1.0)
        result: 'tmpfile', // 'tmpfile', 'base64', 或 'data-uri'
      });
      console.log('捕获成功，临时 URI:', uri);

      const fileName = `screenshot_${Date.now()}.jpg`;
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      console.log('准备移动文件到:', destPath);
      await RNFS.moveFile(uri, destPath); // 移动临时文件到永久位置
      console.log('文件移动成功!');

      // 使用 Platform.select 来处理不同平台的路径格式，以便 Image 组件能正确显示
      const displayUri = Platform.select({
        android: `file://${destPath}`,
        ios: destPath,
      });

      setScreenshotUri(displayUri!);
      console.log('截图保存成功:', displayUri);
      Alert.alert(
        '截图保存成功',
      )

    } catch (error) {
      console.error('截图或保存失败:', error);
      console.error(
        '截图失败',
        '无法捕获或保存图片。这很可能是因为 RTCView 无法被 ViewShot 捕获 (黑屏问题)。请检查控制台日志。'
      );
    } finally {
      setIsTakingShot(false);
    }
  };

  return <>
    <View style={styles.viewContainer}>
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.rtcViewContainer}>
        <RTCView
          streamURL={remoteStream?.toURL()}
          style={styles.stream}
          objectFit="contain"
        />
      </ViewShot>
      {/* 显示带宽和FPS */}
      {/* <View style={styles.statsContainer}>
        <WebRTCConnectInfo RTCPeerConnection={webrtcClient.current} connectedNumber={connectedNumber} />
      </View> */}
      {/* 绝对定位按钮区域 */}
      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <Button title="截屏" onPress={takeScreenshotAndSave} color="#fff" />
          {/* <Button title="消息" onPress={() => { sendMessage('消息测试') }} color="#fff" /> */}
          {/* <RecordButton videoStream={videoStreamRef.current} /> */}
          {/* <AudioStreamTrackBtn enableTitle="开启客户端声音" disableTitle="关闭客户端声音" peerRTCConnect={webrtcClient.current} />
              <AudioButton audioTrack={deviceVideoTrackRef.current} enableTitle="接收设备声音" disableTitle="不接收设备声音" />
              <SetBitrateButton
                // ref={bitrateButtonRef} // 传递 ref
                sendChangeBitrate={sendMessage}
                currentBitrate={bitrate} // 传递当前码率
              /> */}
        </View>
      </View>
    </View>
  </>;
}

const styles = StyleSheet.create({
  statsContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 5,
  },
  statsText: {
    color: 'white',
    fontSize: 14,
  },
  viewContainer: {
    display: 'flex',
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  rtcViewContainer: {
    display: 'flex',
    flex: 1,
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