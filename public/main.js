const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun.service.mozilla.com' }];
const peer = new RTCPeerConnection(iceServers);
const socket = io.connect();

let inboundStream = null;
let initiator = false;

$(document).ready(() => {
  $('#userPrompt').submit(e => {
    e.preventDefault();
    const username = $('#username').val();
    socket.emit('join', username);
    $('#prompt').hide();
    $('#screenshare').show();
  });

  peer.oniceconnectionstatechange = () => {
    console.log(`peer ice state ${peer.iceConnectionState}`);
  };
  peer.ontrack = e => {
    if (initiator) return;
    const video = document.getElementById('screen');
    if (!inboundStream) {
      inboundStream = new MediaStream([e.track]);
    }
    peer.addTrack(e.track, inboundStream);
    video.srcObject = inboundStream;
    video.play();
  };
});

// FUNCTION
async function startScreenShare() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  const tracks = stream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    peer.addTrack(tracks[i], stream);
  }
  const video = document.getElementById('screen');
  video.srcObject = stream;
  video.play();
}

// SOCKET
socket.on('initiator', async id => {
  initiator = true;
  await startScreenShare();
  await peer.setLocalDescription(await peer.createOffer());
  socket.emit('message', { description: peer.localDescription, to: id });
});
socket.on('message', async data => {
  if (data.description) {
    await peer.setRemoteDescription(data.description);
    if (data.description.type === 'offer') {
      await peer.setLocalDescription(await peer.createAnswer());
      socket.emit('message', { description: peer.localDescription, to: data.socket });
    } else if (data.description.type === 'answer') {
    } else console.log('unexpected description type');
  } else if (data.candidate) await peer.addIceCandidate(data.candidate);
  else console.log('unexpected message type');
});
