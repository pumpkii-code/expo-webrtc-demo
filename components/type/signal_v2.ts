export interface BaseMessageData {
  sessionId: string;
  sessionType: 'IE';
  messageId: string;
  from: string;
  to: string;
}

export interface CallPostData {
  audio: 'recvonly';
  video: 'recvonly';
  datachannel: 'true' | 'false';
  iceservers: string;
  user: string;
  source: 'MainStream';
  pwd: string;
  mode: 'live' | 'play';
}

export interface AnswerPostData {
  sdp: string;
  type: RTCSdpType;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IcePostData {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number | null | string;
  label?: string | number;
}

export interface BitrateData {
  bitrate: number;
}

export type SignalPostMessage =
  | {
      eventName: '__connectto';
      data: BaseMessageData;
    }
  | {
      eventName: '__call';
      data: BaseMessageData & CallPostData;
    }
  | {
      eventName: '__ice_candidate';
      data: BaseMessageData & IcePostData;
    }
  | {
      eventName: '__answer';
      data: BaseMessageData & AnswerPostData;
    }
  | {
      eventName: '__disconnected';
      data: BaseMessageData;
    }
  | {
      eventName: '__code_rate';
      data: BaseMessageData & BitrateData;
    }
  | {
      eventName: '__offer';
      data: BaseMessageData;
    };

export interface CreateReceverData {
  domainnameiceServers: string;
  iceServers: string;
  state: 'online' | 'offline' | string;
}

export interface IceCandidateReceverData {
  candidate: string;
  sdpMLineIndex?: number;
  label?: string;
}

export interface OfferReceverData {
  iceservers: string;
  state: 'successed';
  user?: string;
  sdp: string;
  type: RTCSdpType;
}

export interface PingReceverData {}

export interface ConnectInfoReceverData {
  candidate: string;
}

export interface DiconnectedReceverMessage {
  eventName: string;
  data: any;
}

export type SignalReceverMessage =
  | {
      eventName: '_create';
      data: BaseMessageData & CreateReceverData;
    }
  | {
      eventName: '_offer';
      data: BaseMessageData & OfferReceverData;
    }
  | {
      eventName: '_ice_candidate';
      data: BaseMessageData & IceCandidateReceverData;
    }
  | {
      eventName: '_ping';
      data: BaseMessageData & PingReceverData;
    }
  | {
      eventName: '_connectinfo';
      data: BaseMessageData & ConnectInfoReceverData;
    }
  | {
      eventName: '_disconnected';
      data: BaseMessageData & DiconnectedReceverMessage;
    }
  | {
      eventName: '_register';
      data: {
        peerId: string;
      };
    }
  | {
      eventName: '_offline';
      data: {
        peerId: string;
      };
    }
  | {
      eventName: '__ice_candidate';
      data: BaseMessageData & IcePostData;
    };

export interface SignalingCallbacks {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onError?: (error: Event | string) => void;

  // Called when the server acknowledges _connectto and provides ICE servers
  // This happens in both "Device Initiates Offer" and "Browser Initiates Offer" flows,
  // sent to the party that initiated the _connectto.
  onCreate?: (data: BaseMessageData & CreateReceverData) => void;
  onOffer?: (data: BaseMessageData & OfferReceverData) => void;
  onAnswer?: (data: BaseMessageData & AnswerPostData) => void;
  onDeviceIceCandidate?: (
    data: BaseMessageData & IceCandidateReceverData
  ) => void;
  onCall?: (data: BaseMessageData & CallPostData) => void;
  onClientIceCandidate?: (data: BaseMessageData & IcePostData) => void;

  // Browser to Device message (as per PDF pg 8)
  onPostMessage?: (message: any, from: string, sessionId: string) => void;
  // Response to a _post_message sent by this client
  onPostMessageResponse?: (
    message: any,
    result: any,
    from: string,
    sessionId: string
  ) => void;

  // 修改码率
  onChangeBitrate?: (data: BaseMessageData & BitrateData) => void;

  // When the peer actively disconnects the session (PDF pg 10, device initiated _session_disconnected)
  onSessionDisconnected?: (
    message: string | undefined,
    from: string,
    sessionId: string
  ) => void;
  // When the peer actively disconnects using _disconnected (PDF pg 11, browser initiated)
  // This is likely received by the *other* party after one party sends _disconnected
  onPeerDisconnected?: (
    from: string,
    sessionId: string,
    message?: string
  ) => void;
}

export interface CallOptions {
  datachannelEnable?: boolean;
  audioEnable?: 'recvonly';
  videoEnable?: 'recvonly';
  user?: string;
  pwd?: string;
  iceServers?: string;
}

export interface RTCDataChannelSendMessageProps {
  type: string;
  data: string;
  targetViewerId?: string;
}

export type RTCStatsArray = Array<RTCStatsProps>;

export type RTCStatsCandidatePairProps = {
  availableOutgoingBitrate: number;
  nominated: 1 | 0 | boolean;
  state: 'succeeded';
  localCandidateId: string;
  remoteCandidateId: string;
  id: string;
};

export type RTCStatsCandidatePair = {
  type: 'candidate-pair';
} & RTCStatsCandidatePairProps;

export type RTCStatsGoogCandidatePair = {
  type: 'googCandidatePair';
} & RTCStatsCandidatePairProps;

export type RTCStatsLocalCandidate = {
  type: 'local-candidate';
  candidateType: string;
  id: string;
};

export type RTCStatsInboundRTP = {
  type: 'inbound-rtp';
  kind: 'video';
  bytesReceived: number;
  framesDecoded: number;
  id: string;
  decoderImplementation?: string;
  packetsReceived?: number;
  codecId?: string;
  powerEfficientDecoder?: boolean;
};

export type RTCStatsRemoteCandidate = {
  type: 'remote-candidate';
  candidateType: string;
  id: string;
};

export type RTCStatsCodec = {
  type: 'codec';
  mimeType: string;
  payloadType: number;
  id: string;
};

export type RTCStatsProps =
  | RTCStatsCandidatePair
  | RTCStatsGoogCandidatePair
  | RTCStatsLocalCandidate
  | RTCStatsInboundRTP
  | RTCStatsRemoteCandidate
  | RTCStatsCodec;
