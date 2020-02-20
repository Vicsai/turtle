const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
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
    } else peer.addTrack(e.track, inboundStream);
    video.srcObject = inboundStream;
    e.track.onunmute = () => {
      video.play();
    };
  };
  // peer.onnegotiationneeded = async () => {
  //   const offer = await peer.createOffer();
  //   if (peer.signalingState !== 'stable') return;
  //   await peer.setLocalDescription(offer);
  //   socket.emit('message', { description: peer.localDescription, to: peer.host });
  // };
});

// FUNCTION
async function startScreenShare() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const tracks = stream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    peer.addTrack(tracks[i], stream);
  }
  const video = document.getElementById('screen');
  video.srcObject = stream;
  video.play();
}
// TODO make peer connection array that creates a new peer when a user joins the room
// SOCKET
socket.on('initiate', async () => {
  await startScreenShare();
  initiator = true;
  console.log('initiate host');
  await peer.setLocalDescription(await peer.createOffer());
});
socket.on('newUser', async id => {
  socket.emit('message', { description: peer.localDescription, to: id });
});
socket.on('message', async data => {
  if (data.description) {
    if (peer.remoteDescription === null) await peer.setRemoteDescription(data.description);
    if (data.description.type === 'offer') {
      console.log(peer.remoteDescription);
      await peer.setLocalDescription(await peer.createAnswer());
      socket.emit('message', { description: peer.localDescription, to: data.socket });
    } else if (data.description.type === 'answer') console.log(peer.remoteDescription);
    else console.log('unexpected description type');
  }
  if (data.candidate) {
    console.log('ice candidate added');
    await peer.addIceCandidate(data.candidate);
  }
});
