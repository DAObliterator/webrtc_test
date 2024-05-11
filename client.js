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
  video: {
    width: 1080,
    height: 540,
  },
};

if (!window.sessionStorage.getItem("randomId")) {
  randomId = "randomId-" + Math.floor(Math.random() * 100000);
  window.sessionStorage.setItem("randomId", randomId);
}

const socket = io.connect("https://localhost:5010", {
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
  console.log(JSON.stringify(data), " - data , listening to room-joined event");
  for (const i of data.participants) {
    if (i.randomId !== window.sessionStorage.getItem("randomId")) {
      remoteRandomId = i.randomId;
      window.sessionStorage.setItem("remoteRandomId", remoteRandomId);
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
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
  });

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.ontrack = handleTrackEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
  myPeerConnection.oniceconnectionstatechange =
    handleICEConnectionStateChangeEvent;
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

async function handleTrackEvent(ev) {
  console.log(`new track coming in , ev -- ${JSON.stringify(ev)}`);
 
  if (!remoteStream) {
    remoteStream = new MediaStream();
  }
  console.log( ev.track , " --- ev.track before addTrack --- ")
  remoteStream.addTrack(ev.track);
  console.log("Track kind:", ev.track.kind); 
  remoteVideoEl.srcObject = remoteStream;

  


}

function handleNegotiationNeededEvent() {
  myPeerConnection.createOffer().then((offer) => {
    offer_ = offer;
    console.log(
      `setting local description as offer --- ${JSON.stringify(offer)} \n`
    );
    return myPeerConnection
      .setLocalDescription(offer)
      .then(() => {
        console.log(
          myPeerConnection.localDescription,
          " localDescription after it was set to offer"
        );
        const msg = {
          randomId: window.sessionStorage.getItem("randomId"),
          remoteRandomId: window.sessionStorage.getItem("remoteRandomId"),
          description: "offer",
          sdp: myPeerConnection.localDescription, //this becomes null, dont know why
        };

        socket.emit("video-offer", msg);
      })
      .catch((error) => {
        console.log(`ran into error when creating offer - ${error}`);
      }); //sdp
  });
}

function handleICEConnectionStateChangeEvent(event) {
  console.log(myPeerConnection.iceConnectionState , "---iceConnectionState---")
  switch (myPeerConnection.iceConnectionState) {
    case "closed":
    case "failed":
      closeVideoCall();
      break;
  }
}

socket.on("video-offer", (data) => {
  //in this case you are the callee....
  console.log(`${JSON.stringify(data)} --- from the caller `);
  if (data.remoteRandomId === window.sessionStorage.getItem("randomId")) {
    //you are the callee

    console.log("call intended for you , you are the callee");

    let remoteRandomId_;
    remoteRandomId_ = data.remoteRandomId;
    createPeerConnection();

    const desc = new RTCSessionDescription(data.sdp);

    myPeerConnection
      .setRemoteDescription(desc)
      .then(() => navigator.mediaDevices.getUserMedia(mediaConstraints))
      .then((stream) => {
        localStream = stream;
        localVideoEl.srcObject = localStream;

        localStream
          .getTracks()
          .forEach((track) => myPeerConnection.addTrack(track, localStream));
      })
      .then(() => myPeerConnection.createAnswer())
      .then((answer) => {
        return myPeerConnection
          .setLocalDescription(answer)
          .then(() => {
            console.log(
              myPeerConnection.localDescription,
              " localDescription after it was set to answer "
            );
            const msg = {
              randomId: window.sessionStorage.getItem("randomId"),
              remoteRandomId: window.sessionStorage.getItem("remoteRandomId"),
              description: "answer",
              sdp: myPeerConnection.localDescription, //this becomes null, dont know why
            };

            socket.emit("video-answer", msg);
          })
          .catch((error) => console.log(`${error} ran into some error `));
      });
  }
});

socket.on("video-answer", async (msg) => {
  //in this case you are the caller...
  console.log(`listening to video-answer event -- ${JSON.stringify(msg)}   \n`);
  await myPeerConnection.setRemoteDescription(msg.sdp);
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
