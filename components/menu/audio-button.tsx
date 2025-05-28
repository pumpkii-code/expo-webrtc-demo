import { useEffect, useRef, useState } from "react";
import { Button } from "react-native"
import { mediaDevices, RTCPeerConnection, MediaStreamTrack } from "react-native-webrtc";

export default function AudioButton({ audioTrack }: {
  audioTrack: MediaStreamTrack[] | null
}) {
  const [audioEnabled, setAudioEnabled] = useState(false);

  const handleAudioCall = async () => {
    audioTrack?.forEach(track => {
      track.enabled = !audioEnabled;
    });
    setAudioEnabled(!audioEnabled);
  };

  return <Button title={audioEnabled ? "关闭语音" : "开启语音"} onPress={handleAudioCall} color="#fff" />;
}