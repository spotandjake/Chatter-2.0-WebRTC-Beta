let $ =  s => {return document.querySelector(s)};
mdc.ripple.MDCRipple.attachTo($('.mdc-button'));
let configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    }
  ],
  iceCandidatePoolSize: 10
};
let [peer,localStream,remoteStream,roomDialog,roomId] = Array(5).fill(null)
let init = () => {
  $('#MicBtn').addEventListener('click', openUserMic);

  $('#cameraBtn').addEventListener('click', openUserCam);

  $('#ScreenBtn').addEventListener('click', openUserScreen);
  $('#AudioBtn').addEventListener('click', openUserSpeaker);

  $('#hangupBtn').addEventListener('click', hangUp);
  $('#createBtn').addEventListener('click', createRoom);
  $('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new mdc.dialog.MDCDialog($('#room-dialog'));
}
let createRoom = async () => {
  $('#createBtn').disabled = true, $('#joinBtn').disabled = true;
  let roomRef = await firebase.firestore().collection('rooms').doc();
  peer = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(t=>peer.addTrack(t, localStream));
  peer.addEventListener('icecandidate', e => {
    if (e.candidate) roomRef.collection('callerCandidates').add(e.candidate.toJSON());
  });
  let offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  await roomRef.set({'offer': {type: offer.type,sdp: offer.sdp}});
  roomId = roomRef.id;
  $('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`
  peer.addEventListener('track', e => 
    e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t))
  );
  roomRef.onSnapshot(async snap => {
    let dat = snap.data();
    if (!peer.currentRemoteDescription && dat && dat.answer)
      await peer.setRemoteDescription(new RTCSessionDescription(dat.answer));
  });
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async c => {
      if(c.type==='added')
        await peer.addIceCandidate(new RTCIceCandidate(c.doc.data()));
    });
  });
}
let joinRoom = () => {
  $('#createBtn').disabled = true, $('#joinBtn').disabled = true;
  $('#confirmJoinBtn').addEventListener('click', async () => {
    roomId = $('#room-id').value;
    $('#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
    await joinRoomById(roomId);
  }, {once: true});
  roomDialog.open();
}
let joinRoomById = async (roomId) => {
  let roomRef = firebase.firestore().collection('rooms').doc(`${roomId}`), 
    rSnap = await roomRef.get();
  if (rSnap.exists) {
    peer = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(t => peer.addTrack(t,localStream));
    peer.addEventListener('icecandidate', e => {
      if(e.candidate) roomRef.collection('calleeCandidates').add(e.candidate.toJSON());
    });
    peer.addEventListener('track', e => {e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));});
    await peer.setRemoteDescription(new RTCSessionDescription(rSnap.data().offer));
    let answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await roomRef.update({answer: {type: answer.type,sdp: answer.sdp}});
    roomRef.collection('callerCandidates').onSnapshot(snap => {
      snap.docChanges().forEach(async c => {
        if (c.type === 'added') await peer.addIceCandidate(new RTCIceCandidate(c.doc.data()));
      });
    });
  }
}
let openUserMic = async (e) => {
  $('#localVideo').srcObject = localStream = await navigator.mediaDevices.getUserMedia({video: false, audio: true});
  $('#remoteVideo').srcObject = remoteStream = new MediaStream();
  $('#cameraBtn').disabled = true;
  [$('#joinBtn').disabled, $('#createBtn').disabled, $('#hangupBtn').disabled] = Array(3).fill(false);
}
let openUserCam = async (e) => {
  $('#localVideo').srcObject = localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
  $('#remoteVideo').srcObject = remoteStream = new MediaStream();
  $('#cameraBtn').disabled = true;
  [$('#joinBtn').disabled, $('#createBtn').disabled, $('#hangupBtn').disabled] = Array(3).fill(false);
}
let openUserScreen = async (e) => {
  $('#localVideo').srcObject = localStream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
  $('#remoteVideo').srcObject = remoteStream = new MediaStream();
  $('#cameraBtn').disabled = true;
  [$('#joinBtn').disabled, $('#createBtn').disabled, $('#hangupBtn').disabled] = Array(3).fill(false);
}
let openUserSpeaker = async (e) => {
  $('#localVideo').srcObject = localStream = await navigator.mediaDevices.getDisplayMedia({video: false, audio: true});
  $('#remoteVideo').srcObject = remoteStream = new MediaStream();
  $('#cameraBtn').disabled = true;
  [$('#joinBtn').disabled, $('#createBtn').disabled, $('#hangupBtn').disabled] = Array(3).fill(false);
}
let hangUp = async (e) => {
  $('#localVideo').srcObject.getTracks().forEach(track => track.stop());
  if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
  if (peer) peer.close();
  $('#localVideo').srcObject = null;
  $('#remoteVideo').srcObject = null;
  $('#cameraBtn').disabled = false;
  [$('#joinBtn').disabled, $('#createBtn').disabled, $('#hangupBtn').disabled] = Array(3).fill(true);
  $('#currentRoom').innerText = '';
  if (roomId) {
    let roomRef = firebase.firestore().collection('rooms').doc(roomId);
    (await roomRef.collection('calleeCandidates').get()).forEach(async candidate => await candidate.ref.delete());
    (await roomRef.collection('callerCandidates').get()).forEach(async candidate => await candidate.ref.delete());
    await roomRef.delete();
  }
}
init();