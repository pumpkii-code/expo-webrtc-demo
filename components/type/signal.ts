import { RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
export interface BaseMessageData {
  sessionId: string;
  sessionType: 'IE';
  messageId: string;
}

export interface OfferReceverData {
  iceservers: string; // 来自服务器
  iceservers2?: string; // 来自 设备端
  sdp: string;
  type: 'offer';
}

export type SignalingMessage =
  | {
      eventName: '__offer' | '__answer';
      data: {
        to: string;
        from: string;
        sdp?: string;
        iceservers: string;
        iceservers2?: string;
      };
    }
  | {
      eventName: '__register' | '__registered';
      data: {
        peerId: string;
      };
    }
  | {
      eventName: '__connectto' | '__incoming_connection';
      data: {
        to: string;
        from: string;
      };
    }
  | {
      eventName: '__candidate';
      data: {
        from: string;
        candidate?: RTCIceCandidate;
        to: string;
      };
    };

export type SignalingCallbacks = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onRegistered?: () => void; // 添加注册成功的回调
  onOffer?: (data: OfferReceverData) => void;
  onAnswer?: (description: RTCSessionDescription, from: string) => void;
  onCandidate?: (candidate: RTCIceCandidate, from: string) => void;
  onIncomingConnection?: (data: { from?: string; to?: string }) => void;
};
