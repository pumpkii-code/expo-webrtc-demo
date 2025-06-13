import { useEffect, useState } from 'react';
import { webRTCManager } from '@/lib/rtc/single';
import { MediaStream } from 'react-native-webrtc';
import type { State, RTCConectionState } from '@/lib/rtc/single';

interface IUseWebRTC {
  senderCandidate?: (candidateInfo: string) => void;
  senderAnswer?: (sdp: string, answerType: RTCSdpType) => void;
}

export const useWebRTC = (prprs?: IUseWebRTC) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [rtcId, setRtcId] = useState<string | null>(null);
  const [connectionState, setConnectState] = useState<RTCConectionState | null>(
    null
  );
  const [callState, setCallState] = useState<
    'idle' | 'creating' | 'active' | 'ending'
  >('idle');

  // 初始化 => 空依赖数组 只在挂在和卸载的时候执行一次
  useEffect(() => {
    const handleStateChange = (state: State) => {
      setLocalStream(state.localStream);
      setRemoteStream(state.remoteStream);
      setCallState(state.callState);
      setRtcId(state.currentId);
      setConnectState(state.connectionState);
    };

    // 订阅状态更新
    webRTCManager.subscribe(handleStateChange);

    // 组件卸载时取消订阅
    return () => {
      webRTCManager.unsubscribe(handleStateChange);
    };
  }, []);

  return {
    localStream,
    remoteStream,
    callState,
    rtcId,
    connectionState,
    startCall: (iceservers: RTCConfiguration, sdp: string) =>
      webRTCManager.startCall(iceservers, sdp),
    hangUp: () => webRTCManager.hangUp(),
    setRTCId: (id: string) => webRTCManager.setRTCId(id),
    setWsRef: (ref: any) => webRTCManager.setWsRef(ref),
  };
};
