import { useWebRTC } from "@/lib/rtc/hook"
import { useRouter } from "expo-router"
import { Pressable } from "react-native";
import { RTCView } from "react-native-webrtc";

function VideoPreview() {
  const { remoteStream } = useWebRTC()
  const router = useRouter();

  const watchVideoOnFullScreen = () => {
    router.push({
      pathname: '/viewer/fullscreen',
    })
  }

  return (
    <>
      {remoteStream && <>
        <Pressable onPress={watchVideoOnFullScreen}>
          <RTCView
            streamURL={remoteStream.toURL()}
            style={{ width: 200, height: 200 }}
            objectFit="contain"
          />
        </Pressable>
      </>}
    </>
  )
}

export default VideoPreview;