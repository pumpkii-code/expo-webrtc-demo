/*
 * @Author: tonyYo
 * @Date: 2025-05-14 14:56:17
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-16 11:50:23
 * @FilePath: /expo-webrtc-demo/app/viewer/index.tsx
 */
import Viewer from "@/components/webrct/viewer";
import { useRoute } from "@react-navigation/native";



const wsUrl = 'ws://192.168.3.65:5678';

export default function ViewerScreen() {

  // 获取params
  const { serno: peerId } = (useRoute().params ?? { serno: '' }) as { serno: string };

  return (
    <Viewer wsUrl={wsUrl} masterId={peerId} />
  );
}

