import { StyleSheet } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  RTCView,
} from 'react-native-webrtc';
import { Text, View } from '@/components/Themed';
import { SignalingClient } from '@/lib/signal';
import { useWebRTC } from '@/lib/rtc/hook';


const role = 'viewer';
const viewId = '2222'

interface ViewerProps {
  wsUrl: string;
  masterId: string;
}


export default function Viewer({wsUrl, masterId}: ViewerProps) {

    
  // const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signalingClient = useRef<SignalingClient | null>(null);
  // 初始化WebRTC
  const {setupWebRTC, pc, stream: remoteStream, error: rtcError, state} = useWebRTC({role});

  useEffect(() => {
    if (rtcError) {
      setError(rtcError);
    }
  }, [rtcError]);

  // 连接信令服务器
  const connectSignaling = (serverUrl:string) => {
    console.log('[VIEWER] 开始连接信令服务器');
    signalingClient.current = new SignalingClient(serverUrl);
    
    signalingClient.current.connect({
        onConnected: () => {
            setConnected(true);
            setError(null);
            console.log('[VIEWER] 连接信令服务器成功');
            signalingClient.current?.register(viewId);
        },
        onRegistered: () => {
            console.log('[VIEWER] 注册成功');
            signalingClient.current?.connectTo(masterId, viewId);
        },
        onDisconnected: () => {
            setConnected(false);
        },
        onError: (errorMessage) => {
            setError(errorMessage);
        },
        onOffer: async (description) => {
            if (!pc.current) {
                console.error('[VIEWER] WebRTC 未初始化');
                return;
            }
            try {
                console.log('[VIEWER] 收到 offer SDP:', description.sdp);
                console.log('[VIEWER] 设置远程描述...');
                await pc.current.setRemoteDescription(description);
                
                console.log('[VIEWER] 创建应答...');
                const answer = await pc.current.createAnswer();
                console.log('[VIEWER] 应答 SDP:', answer.sdp);
                
                console.log('[VIEWER] 设置本地描述...');
                await pc.current.setLocalDescription(answer);
                console.log('[VIEWER] 本地描述设置成功');
                
                signalingClient.current?.sendAnswer(answer.sdp,masterId);
            } catch (err) {
                console.error('[VIEWER] 处理 offer 时出错:', err);
                setError('处理 offer 失败');
            }
        },
        onCandidate: async (candidate) => {
            if (!pc.current) {
                console.error('[VIEWER] WebRTC 未初始化');
                return;
            }
            await pc.current.addIceCandidate(candidate);
        }
    });

    // 监听 ICE 连接状态变化
    pc.current?.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        signalingClient.current?.sendCandidate(event.candidate,masterId);
      }
    });
  };


  const startViewing = async () => {
    const rtcInitialized = await setupWebRTC();
    if (rtcInitialized) {
      connectSignaling(wsUrl);
    }
  };


  useEffect(() => {
    startViewing();
    return () => {
      if (signalingClient.current) {
        signalingClient.current.disconnect();
      }
    };
  }, []);


  
  


  console.log('[VIEWER] state:',state);
  

  return (
    <View style={styles.container}>
      {error && (state === 'connected') && (
        <Text style={styles.error}>{error}</Text>
      )}
      {!connected && !error &&  (
        <Text style={styles.offlineText}>正在连接服务器...</Text>
      )}
      {state === 'disconnected' && (
        <Text style={styles.offlineText}>设备断开连接</Text>
      )}

      {connected && !remoteStream && !error && (
        <Text>等待主播端开始推流...</Text>
      )}
      {remoteStream && state === 'connected'  && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.stream}
          objectFit="cover"
        />
      )}
       {!remoteStream && (
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
    backgroundColor: '#000',
  },
  stream: {
    flex: 1,
    width: '100%',
    height: '100%',
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