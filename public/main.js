const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun.services.mozilla.com:3478' },
  { urls: 'stun:stunserver.org' }
];
const socket = io.connect();
let peer;
let username;

const connections = {};
let inboundStream;

$(document).ready(() => {
  socket.emit('join');
});

// FUNCTION
async function startScreenshare() {
  document.getElementById('startButton').disabled = false;
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  const tracks = stream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    peer.addTrack(tracks[i], stream);
  }
  console.log('finished adding tracks');
  const video = document.getElementById('screen');
  video.srcObject = stream;
  video.play();
}
async function start() {
  await startScreenshare();
  await peer.setLocalDescription(await peer.createOffer());
  socket.emit('message', { description: peer.localDescription });
}
async function showMessage(message) {
  const div = document.createElement('div');
  div.classList.add('chatLog');
  const text = `${username}: ${message}`;
  div.innerText = text;
  document.getElementById('chatbox').appendChild(div);
}
async function sendChatMessage() {
  const message = document.getElementById('usermsg').value;
  if (message.trim() !== '') {
    showMessage(message.trim());
    document.getElementById('usermsg').value = '';
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
  await peer.setLocalDescription(await peer.createOffer());

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
    if (e.streams && e.streams[0]) {
      video.srcObject = e.streams[0];
    } else {
      if (!inboundStream) {
        inboundStream = new MediaStream([e.track]);
      } else peer.addTrack(e.track, inboundStream);
      video.srcObject = inboundStream;
      e.track.onunmute = () => {
        video.play();
      };
    }
  };
  if (initiator === true) {
    document.getElementById('startButton').disabled = false;
  }
});
socket.on('message', async ({ description, candidate }) => {
  if (description !== undefined) {
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
  const div = document.createElement('div');
  div.classList.add('chatLog');
  const text = `${user}: ${message}`;
  div.innerText = text;
  document.getElementById('chatbox').appendChild(div);
});
socket.on('closeConnection', async id => {
  if (connections[id]) {
    connections[id].close();
    console.log('connection closed');
  } else console.log('invalid connection close');
});
socket.on('sendOffer', async () => {
  socket.emit('message', { description: peer.localDescription });
});
