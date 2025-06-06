import { useEffect, useRef, useState } from "react";
import { Button } from "react-native"
import { mediaDevices, RTCPeerConnection, MediaStreamTrack } from "react-native-webrtc";
import InCallManager from 'react-native-incall-manager';

interface AudioButtonProps {
  audioTrack: MediaStreamTrack[] | null;
  enableTitle: string;
  disableTitle: string;
}

export default function AudioButton({ audioTrack, enableTitle, disableTitle }: AudioButtonProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);

  const handleAudioCall = async () => {
    audioTrack?.forEach(track => {
      track.enabled = !audioEnabled;
    });
    console.log('%c____audioEnabled', 'background:yellow', audioEnabled)
    if (!audioEnabled) {
      try {
        InCallManager.setForceSpeakerphoneOn(true);
        console.log('扬声器已打开 (手动测试)');
      } catch (e) {
        console.error('手动测试扬声器失败:', e);
      }

    } else {
      // InCallManager.setForceSpeakerphoneOn(false);
    }
    setAudioEnabled(!audioEnabled);
  };

  useEffect(() => {
    console.log('扬声器 init');
    InCallManager.start({
      media: 'audio',
      auto: false,  // 禁用自动接近传感器管理
    });
    return () => {
      console.log('扬声器 end');
      InCallManager.stop();
    }
  }, [])

  return <Button title={(audioEnabled ? enableTitle : disableTitle)} onPress={handleAudioCall} color="#fff" />;
}