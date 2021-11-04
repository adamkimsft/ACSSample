import {
  CallClient,
  CallAgent,
  VideoStreamRenderer,
  LocalVideoStream,
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { CommunicationIdentityClient } from "@azure/communication-identity";
import { myMSALObj, username, handleResponse } from "./authPopup";
import { acsUrl, loginRequest, displayName } from "./authConfig";

let call;
let callAgent;
const userToken = document.getElementById("user-token");
const getToken = document.getElementById("token-get");
const getTokenACSUser = document.getElementById("token-get-acs-user");

const commId = document.getElementById("comm-id");
const getCommId = document.getElementById("commid-get");
const getTokenACSComm = document.getElementById("token-get-acs-comm");

const acsToken = document.getElementById("acs-token");
const createCallAgent = document.getElementById("call-agent-create");

const calleeInput = document.getElementById("callee-id-input");
const callButton = document.getElementById("call-button");
const hangUpButton = document.getElementById("hang-up-button");
const stopVideoButton = document.getElementById("stop-Video");
const startVideoButton = document.getElementById("start-Video");

console.log("getToken is " + getToken);
let placeCallOptions;
let deviceManager;
let localVideoStream;
let rendererLocal;
let rendererRemote;

let commIdObj = null;

export function init() {
  // Get teams/aad/user access token by logging in or getting it from cache if already logged in
  getToken.addEventListener("click", async () => {
    console.log("Get access token");

    try {
      let token = await myMSALObj.acquireTokenSilent({
        account: myMSALObj.getAccountByUsername(username),
        scopes: ["https://auth.msft.communication.azure.com/VoIP"],
      });
      userToken.value = token.accessToken;
      console.log("Cached: access token is " + userToken.value);
    } catch (e) {
      try {
        let res = await myMSALObj.loginPopup(loginRequest);
        handleResponse(res);
        userToken.value = res.accessToken;
        console.log("Login: access token is " + userToken.value);
      } catch (error) {
        console.error(error);
      }
    }
  });

  // IMPORTANT - You must perform this function on the server side... someplace secure for production to protect the acsUrl
  // Get an ACS access token for the Teams user access token
  getTokenACSUser.addEventListener("click", async () => {
    const identityClient = new CommunicationIdentityClient(acsUrl);

    try {
      let acsAccessToken = await identityClient.getTokenForTeamsUser(
        userToken.value
      );
      acsToken.value = acsAccessToken;
    } catch (e) {
      alert("Error retrieving ACS token: " + e);
    }
  });

  // IMPORTANT - You must perform this function on the server side... someplace secure for production to protect the acsUrl
  // Create an ACS communications ID
  getCommId.addEventListener("click", async () => {
    const identityClient = new CommunicationIdentityClient(acsUrl);

    let commUserId = await identityClient.createUser();
    commId.value = commUserId.communicationUserId;
    commIdObj = commUserId;
  });

  // Get an ACS access token for the communiations ID
  getTokenACSComm.addEventListener("click", async () => {
    const identityClient = new CommunicationIdentityClient(acsUrl);

    const tokenResponse = await identityClient.getToken(commIdObj, ["voip"]);
    console.log("tokenResponse = " + tokenResponse);
    acsToken.value = tokenResponse.token;
  });

  // Create the call agent
  createCallAgent.addEventListener("click", async () => {
    const callClient = new CallClient();
    console.log("Created CallClient");

    const tokenCredential = new AzureCommunicationTokenCredential(
      acsToken.value
    );
    console.log("Created AzureCommunicationTokenCredential");

    callAgent = await callClient.createCallAgent(tokenCredential, {
      displayName: displayName,
    });
    console.log("Created Call Agent");

    deviceManager = await callClient.getDeviceManager();
    console.log("Got Device Manager");

    callButton.disabled = false;

    callAgent.on("incomingCall", async (e) => {
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

    callAgent.on("callsUpdated", (e) => {
      e.removed.forEach((removedCall) => {
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
  remoteParticipant.on("videoStreamsUpdated", (e) => {
    e.added.forEach((v) => {
      handleVideoStream(v);
    });
  });
  remoteParticipant.videoStreams.forEach((v) => {
    handleVideoStream(v);
  });
}

function subscribeToRemoteParticipantInCall(callInstance) {
  callInstance.on("remoteParticipantsUpdated", (e) => {
    e.added.forEach((p) => {
      subscribeToParticipantVideoStreams(p);
    });
  });
  callInstance.remoteParticipants.forEach((p) => {
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
