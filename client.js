import {
  CallClient,
  CallAgent,
  VideoStreamRenderer,
  LocalVideoStream,
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { CommunicationIdentityClient } from "@azure/communication-identity";
import { myMSALObj, username } from "./authPopup";

let call;
let callAgent;
const userToken = document.getElementById("token-input");
const acsToken = document.getElementById("acs-token-input");
const calleeInput = document.getElementById("callee-id-input");
const callButton = document.getElementById("call-button");
const hangUpButton = document.getElementById("hang-up-button");
const stopVideoButton = document.getElementById("stop-Video");
const startVideoButton = document.getElementById("start-Video");
const getToken = document.getElementById("token-get");
const getTokenACS = document.getElementById("token-get-acs");

console.log("getToken is " + getToken);
let placeCallOptions;
let deviceManager;
let localVideoStream;
let rendererLocal;
let rendererRemote;

export function init() {
  getToken.addEventListener("click", async () => {
    console.log("Azure Communication Services - Access Tokens Quickstart");

    // let identityResponse = await identityClient.createUser();
    // console.log(
    //   `\nCreated an identity with ID: ${identityResponse.communicationUserId}`
    // );

    // // Issue an access token with the "voip" scope for an identity
    // let tokenResponse = await identityClient.getToken(identityResponse, ["voip"]);

    myMSALObj
      .acquireTokenSilent({
        account: myMSALObj.getAccountByUsername(username),
        scopes: ["https://auth.msft.communication.azure.com/VoIP"],
      })
      .then(async res => {
        const { accessToken } = res;
        userToken.value = accessToken;
      });
  });

  // IMPORTANT - You must perform this function on the server side... someplace secure for production
  // It's just placed here for convenience.
  const GetAcsAccessToken = async userAccessToken => {
    const identityClient = new CommunicationIdentityClient(
      "endpoint=https://xxx.communication.azure.com/;accesskey=xxx"
    );

    let acsAccessToken = await identityClient.getTokenForTeamsUser(
      userAccessToken
    );
    return acsAccessToken;
  };

  const GetAcsAccessToken2 = async () => {
    const identityClient = new CommunicationIdentityClient(
      "endpoint=https://xxx.communication.azure.com/;accesskey=xxx"
    );


    let communicationUserId = await identityClient.createUser();
    const tokenResponse = await identityClient.getToken(communicationUserId, ["voip"]);
    console.log("tokenResponse = " + tokenResponse)
    return tokenResponse;
  }

  getTokenACS.addEventListener("click", async () => {
    console.log(userToken.value);

    // let acsAccessToken = await GetAcsAccessToken(userToken.value);
    let acsAccessToken = await GetAcsAccessToken2();
    acsToken.value = acsAccessToken.token;
    
    const callClient = new CallClient();
    console.log("Created CallClient");

    const tokenCredential = new AzureCommunicationTokenCredential(
      acsAccessToken.token
    );
    console.log("Created AzureCommunicationTokenCredential");
    callAgent = await callClient.createCallAgent(tokenCredential, {
      displayName: "adamkim",
    });

    deviceManager = await callClient.getDeviceManager();
    callButton.disabled = false;

    callAgent.on("incomingCall", async e => {
      const videoDevices = await deviceManager.getCameras();
      const videoDeviceInfo = videoDevices[0];
      localVideoStream = new LocalVideoStream(videoDeviceInfo);
      localVideoView();

      stopVideoButton.disabled = false;
      callButton.disabled = true;
      hangUpButton.disabled = false;

      const addedCall = await e.incomingCall.accept({
        videoOptions: { localVideoStreams: [localVideoStream] },
      });
      call = addedCall;

      subscribeToRemoteParticipantInCall(addedCall);
    });

    callAgent.on("callsUpdated", e => {
      e.removed.forEach(removedCall => {
        // dispose of video renderers
        rendererLocal.dispose();
        rendererRemote.dispose();
        // toggle button states
        hangUpButton.disabled = true;
        callButton.disabled = false;
        stopVideoButton.disabled = true;
      });
    });

    // console.log(res.accessToken);
  });

  callButton.addEventListener("click", async () => {
    const videoDevices = await deviceManager.getCameras();
    const videoDeviceInfo = videoDevices[0];
    localVideoStream = new LocalVideoStream(videoDeviceInfo);
    placeCallOptions = {
      videoOptions: { localVideoStreams: [localVideoStream] },
    };

    localVideoView();
    stopVideoButton.disabled = false;
    startVideoButton.disabled = true;

    const userToCall = calleeInput.value;
    call = callAgent.startCall(
      [{ communicationUserId: userToCall }],
      placeCallOptions
    );

    subscribeToRemoteParticipantInCall(call);

    hangUpButton.disabled = false;
    callButton.disabled = true;
  });

  stopVideoButton.addEventListener("click", async () => {
    await call.stopVideo(localVideoStream);
    rendererLocal.dispose();
    startVideoButton.disabled = false;
    stopVideoButton.disabled = true;
  });

  startVideoButton.addEventListener("click", async () => {
    await call.startVideo(localVideoStream);
    localVideoView();
    stopVideoButton.disabled = false;
    startVideoButton.disabled = true;
  });

  hangUpButton.addEventListener("click", async () => {
    // dispose of video renderers
    rendererLocal.dispose();
    rendererRemote.dispose();
    // end the current call
    await call.hangUp();
    // toggle button states
    hangUpButton.disabled = true;
    callButton.disabled = false;
    stopVideoButton.disabled = true;
  });
}
// Get Access Topken

function handleVideoStream(remoteVideoStream) {
  remoteVideoStream.on("isAvailableChanged", async () => {
    if (remoteVideoStream.isAvailable) {
      remoteVideoView(remoteVideoStream);
    } else {
      rendererRemote.dispose();
    }
  });
  if (remoteVideoStream.isAvailable) {
    remoteVideoView(remoteVideoStream);
  }
}

function subscribeToParticipantVideoStreams(remoteParticipant) {
  remoteParticipant.on("videoStreamsUpdated", e => {
    e.added.forEach(v => {
      handleVideoStream(v);
    });
  });
  remoteParticipant.videoStreams.forEach(v => {
    handleVideoStream(v);
  });
}

function subscribeToRemoteParticipantInCall(callInstance) {
  callInstance.on("remoteParticipantsUpdated", e => {
    e.added.forEach(p => {
      subscribeToParticipantVideoStreams(p);
    });
  });
  callInstance.remoteParticipants.forEach(p => {
    subscribeToParticipantVideoStreams(p);
  });
}

async function localVideoView() {
  rendererLocal = new VideoStreamRenderer(localVideoStream);
  const view = await rendererLocal.createView();
  document.getElementById("myVideo").appendChild(view.target);
}

async function remoteVideoView(remoteVideoStream) {
  rendererRemote = new VideoStreamRenderer(remoteVideoStream);
  const view = await rendererRemote.createView();
  document.getElementById("remoteVideo").appendChild(view.target);
}
