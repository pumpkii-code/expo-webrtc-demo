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
  type: string;
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
  user: string;
  sdp: string;
  type: 'offer';
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
    };
