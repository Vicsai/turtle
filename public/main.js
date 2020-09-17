const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stunserver.org' }];
// const peer = new RTCPeerConnection(iceServers);
const socket = io.connect();
let peer;
let username;

const connections = {};
let inboundStream;

$(document).ready(() => {
  socket.emit('join');
});

// FUNCTION
async function startScreenShare() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  const tracks = stream.getTracks();
  console.log(tracks);
  for (let i = 0; i < tracks.length; i++) {
    peer.addTrack(tracks[i], stream);
  }
  console.log('finished adding tracks');
  const video = document.getElementById('screen');
  video.srcObject = stream;
  video.play();
}
async function showMessage(message) {
  const node = document.createElement('LI');
  const textnode = document.createTextNode(`${username}: ${message}`);
  node.appendChild(textnode);
  document.getElementById('chatbox').appendChild(node);
}
async function sendChatMessage() {
  const message = document.getElementById('usermsg');
  if (message.value.trim() !== '') {
    showMessage(message.value.trim());
    message.value = '';
    socket.emit('message', { message });
  }
}

function send(e) {
  if (e.keyCode === 13) {
    sendChatMessage();
  }
}

// SOCKET

socket.on('initiate', async ({ initiator, socketID, socketUsername }) => {
  peer = new RTCPeerConnection(iceServers);
  username = socketUsername;
  connections[socketID] = peer;
  peer.oniceconnectionstatechange = () => {
    console.log(`peer ice state ${peer.iceConnectionState}`);
  };
  peer.onnegotiationneeded = async () => {
    await peer.setLocalDescription(await peer.createOffer());
    socket.emit('message', { description: peer.localDescription });
  };
  peer.onicecandidate = e => {
    if (!e || !e.candidate) return;
    console.log('found a candidate');
    socket.emit('message', { candidate: e.candidate });
  };
  peer.ontrack = e => {
    if (initiator) return;
    const video = document.getElementById('screen');
    if (!inboundStream) {
      inboundStream = new MediaStream([e.track]);
    } else peer.addTrack(e.track, inboundStream);
    video.srcObject = inboundStream;
    e.track.onunmute = () => {
      video.play();
    };
  };
  if (initiator === true) {
    await startScreenShare();
    await peer.setLocalDescription(await peer.createOffer());
    socket.emit('message', { description: peer.localDescription });
  }
});
socket.on('message', async ({ description, candidate }) => {
  if (description !== undefined) {
    console.log(description);
    if (description.type === 'offer') {
      console.log('recieved offer');
      await peer.setRemoteDescription(description);
      await peer.setLocalDescription(await peer.createAnswer());
      console.log('creating answer');
      socket.emit('message', { description: peer.localDescription });
    } else if (description.type === 'answer') {
      await peer.setRemoteDescription(description);
      console.log('answer recieved');
    } else console.log('unexpected description type');
  }
  if (candidate !== undefined) {
    console.log(candidate);
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('ice candidate added');
  }
});
socket.on('newChatMessage', async ({ user, message }) => {
  console.log(`chat being called, message is ${message}`);
  const node = document.createElement('LI');
  const textnode = document.createTextNode(`${user}: ${message}`);
  node.appendChild(textnode);
  document.getElementById('chatbox').appendChild(node);
});
socket.on('closeConnection', async id => {
  if (connections[id]) {
    connections[id].close();
    console.log('connection closed');
  } else console.log('invalid connection close');
});
