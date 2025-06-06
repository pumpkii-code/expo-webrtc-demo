import { useState, useRef, useEffect } from 'react';
import { Button } from 'react-native';
import { mediaDevices, MediaStreamTrack, MediaStream, RTCPeerConnection } from "react-native-webrtc";
import InCallManager from 'react-native-incall-manager';

interface AudioStreamTrackBtnProps {
  // audioTrack: MediaStreamTrack[] | null;
  enableTitle: string;
  disableTitle: string;
  peerRTCConnect: RTCPeerConnection | null;
}
export default function AudioStreamTrackBtn({
  // audioTrack, 
  enableTitle, disableTitle, peerRTCConnect }: AudioStreamTrackBtnProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioStreamRef = useRef<MediaStream>(null);
  const audioTrackRef = useRef<MediaStreamTrack[] | null>(null);

  const initAudioStream = async () => {
    try {
      const audioStream = await mediaDevices.getUserMedia({
        audio: true,
        // video: {
        //   facingMode: 'user',
        //   width: { ideal: 1280 },
        //   height: { ideal: 720 },
        // }
        video: false
      });
      audioStreamRef.current = audioStream;
      return audioStream;
    } catch (error) {
      console.error('麦克风获取失败:', error);
    }
  };

  const handleAudioCall = async () => {
    if (!audioStreamRef.current) {
      const audioStream = await initAudioStream();
      if (!audioStream) {
        console.error('无法获取麦克风权限');
        return;
      }

      try {
        InCallManager.start({
          media: 'audio',
          auto: false,  // 禁用自动接近传感器管理
        });
        InCallManager.setForceSpeakerphoneOn(true);
        console.log('扬声器已打开 (手动测试)');
      } catch (e) {
        console.error('手动测试扬声器失败:', e);
      }

      if (peerRTCConnect) {
        audioTrackRef.current = audioStream.getAudioTracks();
        audioTrackRef.current.forEach(track => {
          track.enabled = false;
          peerRTCConnect?.addTrack(track, audioStreamRef.current!);
        });
      }
    }

    audioTrackRef.current?.forEach(track => {
      track.enabled = !audioEnabled;
    });

    setAudioEnabled(!audioEnabled);
  };

  useEffect(() => {
    return () => {
      InCallManager.stop();
    };
  }, []);

  return <Button title={(audioEnabled ? enableTitle : disableTitle)} onPress={handleAudioCall} color="#fff" />;
}