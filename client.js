let localStream;
let remoteStream;
let remoteRandomId;
let myPeerConnection;
let roomName;
let offer_;
let answer_;
let randomId;
let didIOffer = false;
const localVideoEl = document.querySelector("#local-video");
const remoteVideoEl = document.querySelector("#remote-video");
const showVideoButton = document.querySelector("#showVideo");


let remoteIceCandidate;

let mediaConstraints = {
  //audio: true,
  video: true,
};

if (!window.sessionStorage.getItem("randomId")) {
  randomId = "randomId-" + Math.floor(Math.random() * 100000);
  window.sessionStorage.setItem("randomId", randomId);
}

const socket = io.connect(`http://localhost:5010`, {
  auth: {
    randomId: window.sessionStorage.getItem("randomId"),
  },
});



document.getElementById("New-Chat").addEventListener("click", () => {
  console.log(`New-Chat Button Clicked \n`);

  socket.emit("find-partner", {
    randomId: randomId,
  });

 
  call();
});

 socket.on("room-joined", (data) => {
   console.log(
     JSON.stringify(data),
     " - data , listening to room-joined event"
   );
   for ( const i of data.participants) {
    if ( i.randomId !== window.sessionStorage.getItem("randomId") ) {
      remoteRandomId = i.randomId;
      window.sessionStorage.setItem("remoteRandomId" , remoteRandomId);

    }
   }
   roomName = data.roomName;
   window.sessionStorage.setItem("roomName", roomName);
   window.sessionStorage.setItem("remoteRandomId", remoteRandomId);
 });

const call = () => {
  if (myPeerConnection) {
    alert("You cannot start a call because you have got already one open\n");
  } else {

    createPeerConnection();
    navigator.mediaDevices
      .getUserMedia(mediaConstraints)
      .then((localStream) => {
        localVideoEl.srcObject = localStream;
        localStream
          .getTracks()
          .forEach((track) => myPeerConnection.addTrack(track, localStream));
      })
      .catch((error) => {
        console.log(`${error} --- error happened while adding tracks \n`);
      });
  }
};

function createPeerConnection() {
  myPeerConnection = new RTCPeerConnection();

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.ontrack = handleTrackEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
}

function handleICECandidateEvent(e) {
  console.log("...Ice candidate found!....");
  console.log(e, " e in handleICECandidate");
  if (e.candiate) {
    socket.emit("new-ice-candidate", {
      target: remoteRandomId,
      candiate: e.candidate,
    });
  }
}

function handleTrackEvent(ev) {
  if (ev.streams && ev.streams[0]) {
    remoteVideoEl.srcObject = ev.streams[0];
  } else {
    remoteStream = new MediaStream(ev.track);
    remoteVideoEl.srcObject = remoteStream;
  }
}

function handleNegotiationNeededEvent() {
  myPeerConnection
    .createOffer()
    .then((offer) => {
      offer_ = offer;
      console.log(`setting local description as offer --- ${JSON.stringify(offer)} \n`);
      myPeerConnection.setLocalDescription(offer); //sdp

      
      socket.emit("video-offer", {
        randomId: window.sessionStorage.getItem("randomId"),
        remoteRandomId: window.sessionStorage.getItem("remoteRandomId"),
        description: "offer",
        sdp: offer,
      });
      
    })
    .then(() => {
      
    })
    .catch((error) => {
      console.log(`ran into error when creating offer - ${error}`);
    });
}

socket.on("video-offer", (data) => {
  //in this case you are the callee....
  console.log(`${JSON.stringify(data)} --- from the caller `);
  if (data.remoteRandomId === randomId) {
    //you are the callee

    console.log("call intended for you , you are the callee")

    let remoteRandomId_;
    remoteRandomId_ = data.remoteRandomId;
    createPeerConnection();

    const desc = new RTCSessionDescription(data.sdp);

    myPeerConnection
      .setRemoteDescription(desc)
      .then(() => navigator.mediaDevices.getUserMedia(mediaConstraints))
      .then((stream) => {
        localStream = stream;
        document.getElementById("local_video").srcObject = localStream;

        localStream
          .getTracks()
          .forEach((track) => myPeerConnection.addTrack(track, localStream));
      })
      .then(() => myPeerConnection.createAnswer())
      .then((answer) => myPeerConnection.setLocalDescription(answer))
      .then(() => {
        const msg = {
          randomId: data.randomId,
          remoteRandomId: remoteRandomId_,
          sdp: myPeerConnection.localDescription,
        };

        socket.emit("video-answer", data);
      })
      .catch((error) => console.log(`${error} ran into some error `));
  }
});

socket.on("video-answer", (msg) => {
  //in this case you are the caller...
  console.log(`listening to video-answer evevnt  \n`);
  myPeerConnection.setRemoteDescription(msg.sdp);
});

socket.on("new-ice-candidate", (msg) => {
  console.log(`listening to new-ice-candidate event`);

  handleNewICECandidateMsg(msg);
});

function handleNewICECandidateMsg(msg) {
  /*
    {
      target: remoteRandomId,
      candiate: e.candidate,
    } this is going to be the format of the msg object 
  */

  console.log(msg, `msg inside new-ice-candidate`);
  const candidate = new RTCIceCandidate(msg.candidate);
  myPeerConnection.addIceCandidate(candidate).catch((error) => {
    console.log(`${error} happened while adding ice candidates `);
  });
}
