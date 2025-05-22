/*
 * @Author: tonyYo
 * @Date: 2025-05-14 14:56:17
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-16 11:50:23
 * @FilePath: /expo-webrtc-demo/app/viewer/index.tsx
 */
import TestComponent from "@/components/webrct/viewer_v2";
import { useRoute } from "@react-navigation/native";



const wsUrl = 'ws://webrtc.qq-kan.com/';

export default function ViewerScreen() {

  return (
    <TestComponent wsurl={wsUrl} />
  );
}

