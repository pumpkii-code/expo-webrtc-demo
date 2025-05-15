/*
 * @Author: tonyYo
 * @Date: 2025-05-14 14:56:17
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-15 16:30:51
 * @FilePath: /expo-webrtc-demo/app/viewer/index.tsx
 */
import Viewer from "@/components/webrct/viewer";
import { useRoute } from "@react-navigation/native";



const wsUrl = 'ws://192.168.3.207:8080';

export default function ViewerScreen() {

  // 获取params
  const {serno} = useRoute().params as {serno: string};

  return (
      <Viewer wsUrl={wsUrl} masterId={serno}/>
  );
}

