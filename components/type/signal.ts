export interface BaseMessageData {
  sessionId: string;
  sessionType: 'IE';
  messageId: string;
}

export interface OfferReceverData {
  iceservers: string;
}

export type SignalingMessage =
  | {
      eventName: '__offer' | '__answer';
      data: {
        to: string;
        from: string;
        sdp?: string;
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
  onOffer?: (description: RTCSessionDescription) => void;
  onAnswer?: (description: RTCSessionDescription, from: string) => void;
  onCandidate?: (candidate: RTCIceCandidate, from: string) => void;
  onIncomingConnection?: (data: { from?: string; to?: string }) => void;
};
