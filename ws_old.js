/*
 * @Author: tonyYo
 * @Date: 2025-05-14 10:23:37
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-15 18:13:55
 * @FilePath: /expo-webrtc-demo/ws.js
 */
const WebSocket = require('ws');
const port = 5678;
const wss = new WebSocket.Server({ port });

const peers = {};
const connections = {
  // [viewId]:[masterId]
};

// const iceservers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const iceservers = '{"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]}';

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { eventName, data } = JSON.parse(message);
    console.log('Received message:', eventName);

    if (eventName === '__register') {
      // 从客户端获取peerId
      const { peerId } = data;
      if (!peerId) {
        console.error('缺少peerId');
        return;
      }

      console.log(`Peer ${peerId} registered`);
      ws.peerId = peerId;
      peers[peerId] = ws;

      ws.send(
        JSON.stringify({
          eventName: '__registered',
          data: { peerId },
        })
      );

      // 如果是主播，则需要通知等待中的用户,  connections 里面的value 是 主播的id, 需要反查出value 为 peerId 的key
      const waitingViewers = Object.keys(connections).filter(
        (key) => connections[key] === peerId
      );
      waitingViewers.forEach((viewer) => {
        console.log(`通知等待中的用户 ${viewer} 有新的主播 ${peerId}`);
        peers[peerId].send(
          JSON.stringify({
            eventName: '__incoming_connection',
            data: {
              from: viewer,
              to: peerId,
            },
          })
        );
      });

      return;
    }

    if (eventName === '__connectto') {
      const { to, from } = data;
      // 创建一个连接记录
      connections[from] = to;
      if (peers[to]) {
        console.log(`Viewer ${from} connecting to Master ${to}`);
        peers[to].send(
          JSON.stringify({
            eventName: '__incoming_connection',
            data: {
              from,
              to,
            },
          })
        );
      }
      return;
    }

    // 转发WebRTC信令
    if (
      eventName === '__offer' ||
      eventName === '__answer' ||
      eventName === '__candidate'
    ) {
      const { to } = data;
      if (peers[to]) {
        console.log(`转发 ${eventName} 从 ${ws.peerId} 到 ${to}`);
        peers[to].send(
          JSON.stringify({
            eventName,
            data: { ...data, from: ws.peerId, iceservers },
          })
        );
      }
    }
  });

  ws.on('close', () => {
    // 清理断开的连接
    const peerId = ws.peerId;
    if (peerId && peers[peerId]) {
      console.log(`Peer ${peerId} 断开连接`);
      delete peers[peerId];
      delete connections[peerId];
    }

    //如果是用户，则需要从
  });
});

console.log('old____Signaling server running on ws://localhost: ' + port);
