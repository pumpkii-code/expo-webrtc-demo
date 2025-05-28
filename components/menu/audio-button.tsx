import { useEffect, useRef, useState } from "react";
import { Button } from "react-native"
import { mediaDevices, RTCPeerConnection, MediaStreamTrack } from "react-native-webrtc";

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
    setAudioEnabled(!audioEnabled);
  };

  return <Button title={(audioEnabled ? enableTitle : disableTitle)} onPress={handleAudioCall} color="#fff" />;
}