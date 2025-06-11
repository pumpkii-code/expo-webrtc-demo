const aedes = require('aedes')();
const net = require('net');

// 创建 MQTT 代理服务器
const server = net.createServer(aedes.handle);
const port = 1883;

server.listen(port, function () {
  console.log('Aedes MQTT 代理已启动，监听端口:', port);
});

// 客户端连接事件
aedes.on('client', function (client) {
  console.log('客户端已连接:', client.id);
});

// 客户端断开连接事件
aedes.on('clientDisconnect', function (client) {
  console.log('客户端已断开连接:', client.id);
});

// 消息发布事件
aedes.on('publish', function (packet, client) {
  if (client) {
    console.log('消息发布 - 客户端:', client.id, '主题:', packet.topic);
  }
});

// 订阅事件
aedes.on('subscribe', function (subscriptions, client) {
  console.log('客户端订阅 - 客户端:', client.id, '主题:', subscriptions.map(s => s.topic).join(', '));
});

// 取消订阅事件
aedes.on('unsubscribe', function (subscriptions, client) {
  console.log('客户端取消订阅 - 客户端:', client.id, '主题:', subscriptions.join(', '));
});

// 错误处理
aedes.on('clientError', function (client, err) {
  console.log('客户端错误:', client.id, err.message);
});

server.on('error', function (err) {
  console.log('服务器错误:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', function () {
  console.log('\n正在关闭 Aedes MQTT 代理...');
  server.close(function () {
    console.log('Aedes MQTT 代理已关闭');
    process.exit(0);
  });
});